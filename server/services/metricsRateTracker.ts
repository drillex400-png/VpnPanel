/**
 * Turns the raw cumulative counters parseRealLinuxMetrics() pulls from /proc/stat and
 * /proc/net/dev into actual rates (CPU usage %, network Kbps) by diffing against the
 * previous poll for the same server connection.
 *
 * Why this exists: a single snapshot of /proc/stat or /proc/net/dev only tells you totals
 * since boot -- it says nothing about *current* usage. The previous implementation covered
 * for this by approximating CPU% from the 1-minute load average (a related but genuinely
 * different metric -- load average counts runnable/uninterruptible processes, not %busy) and
 * by returning frankly-fake random numbers for network throughput on every server, including
 * real (non-demo) ones. This module fixes both by keeping one previous sample per pooled SSH
 * connection and computing true deltas, exactly how tools like `top`/`iftop` do it:
 *   cpu%   = 100 * (Δbusy_ticks / Δtotal_ticks)
 *   rxKbps = (Δrx_bytes * 8 / 1000) / Δseconds
 *
 * The very first poll for a given key has nothing to diff against yet, so it's left on the
 * loadavg-proxy CPU% and 0 Kbps that parseRealLinuxMetrics() already fills in -- exactly one
 * poll cycle of "still warming up", after which every value is a real measured rate.
 */

interface CpuTicks {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
}

interface RawSample {
  cpuTicks: CpuTicks;
  rxBytes: number;
  txBytes: number;
  sampledAt: number;
}

interface MetricsWithRaw {
  cpu: { usagePct: number; [k: string]: any };
  network: { rxKbps: number; txKbps: number; [k: string]: any };
  _raw?: RawSample;
  [k: string]: any;
}

const previousSamples = new Map<string, RawSample>();

function cpuBusy(t: CpuTicks): number {
  return t.user + t.nice + t.system + t.irq + t.softirq + t.steal;
}
function cpuTotal(t: CpuTicks): number {
  return cpuBusy(t) + t.idle + t.iowait;
}

/**
 * Mutates `metrics` in place, replacing the same-snapshot CPU%/network fallback values with
 * true delta-derived rates when a previous sample for `key` exists, then stores the current
 * raw sample for next time. Strips the internal `_raw` field before returning so it never
 * leaks into the JSON sent to the frontend. Safe to call every poll tick unconditionally.
 */
export function applyAccurateRates(key: string, metrics: MetricsWithRaw): MetricsWithRaw {
  const raw = metrics._raw;
  delete metrics._raw;

  if (!raw) return metrics; // demo metrics / anything that didn't come from parseRealLinuxMetrics

  const prev = previousSamples.get(key);
  previousSamples.set(key, raw);

  if (!prev) return metrics; // first poll for this connection -- nothing to diff against yet

  const deltaSeconds = (raw.sampledAt - prev.sampledAt) / 1000;
  if (deltaSeconds <= 0) return metrics; // clock skew / duplicate tick guard

  const deltaTotal = cpuTotal(raw.cpuTicks) - cpuTotal(prev.cpuTicks);
  const deltaBusy = cpuBusy(raw.cpuTicks) - cpuBusy(prev.cpuTicks);
  if (deltaTotal > 0) {
    metrics.cpu.usagePct = Math.min(100, Math.max(0, Math.round((deltaBusy / deltaTotal) * 100)));
  }

  const deltaRx = raw.rxBytes - prev.rxBytes;
  const deltaTx = raw.txBytes - prev.txBytes;
  // Counters can wrap/reset (interface reset, 32-bit rollover) -- a negative delta means the
  // sample isn't comparable, so just leave the 0 fallback rather than report garbage.
  if (deltaRx >= 0) metrics.network.rxKbps = Math.round((deltaRx * 8) / 1000 / deltaSeconds);
  if (deltaTx >= 0) metrics.network.txKbps = Math.round((deltaTx * 8) / 1000 / deltaSeconds);

  return metrics;
}

/** Drop tracked state for a connection -- call when a pooled SSH connection is torn down so
 * a brand-new connection later doesn't diff against a stale sample from a previous session. */
export function clearRateTracking(key: string): void {
  previousSamples.delete(key);
}
