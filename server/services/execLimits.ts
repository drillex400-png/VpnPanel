/**
 * Shared safety limits for anything that runs a command over an SSH channel (pooled or
 * ad-hoc) and accumulates its stdout/stderr in memory before resolving.
 *
 * Without these, a single hung command (an interactive prompt waiting on stdin, `tail -f`,
 * `yes`, a runaway `journalctl -f`, or just a slow/stalled network path) or an
 * unexpectedly chatty one keeps the SSH channel -- and the underlying HTTP request/await
 * chain -- open indefinitely, and every byte it emits gets appended to a JS string with no
 * ceiling. On a long enough timeline that's an unbounded memory leak per stuck command and
 * a way to wedge a pooled connection (and the request awaiting it) forever.
 */

// Generous enough for real sysadmin output (a full `journalctl`, `ls -la` of a huge
// directory, a verbose install script) while still bounding a runaway/malicious command
// from growing memory without limit.
export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB per stream (stdout and stderr separately)

// Generous enough for slow apt-get installs / VPN protocol validation, but a hard ceiling
// so a hung command can't hold a pooled SSH channel (and the HTTP request awaiting it)
// open forever.
export const EXEC_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

const TRUNCATION_NOTICE = "\n... [вывод обрезан: превышен лимит 5MB на поток] ...";

/**
 * Accumulates stream output up to `maxBytes`, then silently drops further data (flagging
 * `truncated`) instead of growing without bound. The byte accounting is approximate (based
 * on UTF-8 byte length of each appended chunk, sliced by JS string length for the boundary
 * chunk) -- precise enough for a safety cap, not meant to be exact-to-the-byte.
 */
export class BoundedCollector {
  private chunks: string[] = [];
  private bytesSoFar = 0;
  public truncated = false;

  constructor(private readonly maxBytes: number = MAX_OUTPUT_BYTES) {}

  append(data: Buffer | string): void {
    if (this.truncated) return;
    const str = typeof data === "string" ? data : data.toString();
    const remaining = this.maxBytes - this.bytesSoFar;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    const strBytes = Buffer.byteLength(str);
    if (strBytes > remaining) {
      // Approximate boundary slice by character count, not exact byte count -- fine for a
      // soft safety cap.
      this.chunks.push(str.slice(0, remaining));
      this.bytesSoFar = this.maxBytes;
      this.truncated = true;
      return;
    }
    this.chunks.push(str);
    this.bytesSoFar += strBytes;
  }

  toString(): string {
    return this.truncated ? this.chunks.join("") + TRUNCATION_NOTICE : this.chunks.join("");
  }
}

/**
 * Starts a timeout that, if it fires before `clear()` is called, invokes `onTimeout` exactly
 * once. Callers pass in a way to forcibly tear down whatever's still running (closing an SSH
 * channel, ending a connection, etc.) as `onTimeout`.
 */
export function startExecTimeout(ms: number, onTimeout: () => void): { clear: () => void } {
  let fired = false;
  const timer = setTimeout(() => {
    if (fired) return;
    fired = true;
    onTimeout();
  }, ms);
  // Don't let this timer keep the Node process alive on its own.
  timer.unref?.();
  return {
    clear: () => {
      fired = true; // prevents a race where the timer fires just after clear() was called
      clearTimeout(timer);
    },
  };
}
