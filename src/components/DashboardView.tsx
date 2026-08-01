import React, { useState, useEffect } from "react";
import { SystemMetrics, SSHConfig } from "../types";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Server,
  Terminal,
  FolderOpen,
  ListTree,
  ShieldCheck,
  Wrench,
  RefreshCw,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";

interface DashboardViewProps {
  metrics: SystemMetrics;
  server: SSHConfig;
  onNavigateTab: (tab: any) => void;
  onRefresh: () => void;
  connectionLatencyMs?: number | null;
}

type MetricKey = "cpu" | "ram" | "disk" | "network";
type NodeStatus = "normal" | "warn" | "danger";

function statusOf(pct: number): NodeStatus {
  if (pct > 80) return "danger";
  if (pct > 50) return "warn";
  return "normal";
}

const STATUS_SOLID: Record<NodeStatus, string> = {
  normal: "#a78bfa",
  warn: "#fbbf24",
  danger: "#f43f5e",
};
const STATUS_TEXT: Record<NodeStatus, string> = {
  normal: "text-violet-300",
  warn: "text-amber-300",
  danger: "text-rose-400",
};
const STATUS_GLOW: Record<NodeStatus, string> = {
  normal: "rgba(167,139,250,0.55)",
  warn: "rgba(251,191,36,0.55)",
  danger: "rgba(244,63,94,0.6)",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return <div className="h-10 flex items-center text-[10px] text-slate-500">Собираю историю…</div>;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 27 - 1.5}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-10">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Instrument cluster gauge -- a real analog dial (260deg sweep through the top,
// like a car speedometer/tachometer) instead of a flat progress ring. All angle
// math uses a "clockwise-from-12-o'clock" convention (theta=0 is straight up),
// which conveniently maps 1:1 onto SVG's own `rotate(deg, cx, cy)` transform, so
// the needle rotation below needs zero extra origin bookkeeping.
// ---------------------------------------------------------------------------
const GAUGE_START = -130;
const GAUGE_SWEEP = 260;

function angleForPct(pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  return GAUGE_START + (clamped / 100) * GAUGE_SWEEP;
}

function polarPoint(cx: number, cy: number, r: number, thetaDeg: number) {
  const rad = (thetaDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarPoint(cx, cy, r, startDeg);
  const end = polarPoint(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const TICKS = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

function GaugeDial({
  label,
  icon: Icon,
  pct,
  displayValue,
  status,
  size,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.ElementType;
  pct: number;
  displayValue: React.ReactNode;
  status: NodeStatus;
  size: "lg" | "md";
  selected: boolean;
  onSelect: () => void;
}) {
  const trackD = arcPath(50, 50, 40, GAUGE_START, GAUGE_START + GAUGE_SWEEP);
  const valueD = trackD;
  const needleDeg = angleForPct(pct);
  const dim = size === "lg" ? 148 : 122;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex items-center gap-1.5 ${STATUS_TEXT[status]}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <button
        onClick={onSelect}
        className={`relative rounded-full transition-transform active:scale-[0.97] ${
          selected ? "ring-2 ring-ring/60" : ""
        }`}
        style={{ width: dim, height: dim }}
      >
        {/* Bezel / glass housing */}
        <span className="absolute inset-0 rounded-full bg-card border border-input shadow-inner" />
        {/* Glass reflection highlight, purely decorative */}
        <span
          className="absolute inset-[6%] rounded-full pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(196,165,255,0.10) 0%, transparent 45%)" }}
        />

        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id={`gaugeGrad-${label}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
          </defs>

          {/* Static track */}
          <path d={trackD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} strokeLinecap="round" />

          {/* Tick marks */}
          {TICKS.map((t) => {
            const isMajor = t % 25 === 0;
            const a = angleForPct(t);
            const inner = polarPoint(50, 50, isMajor ? 27 : 30, a);
            const outer = polarPoint(50, 50, 36, a);
            return (
              <line
                key={t}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isMajor ? "rgba(196,165,255,0.45)" : "rgba(255,255,255,0.16)"}
                strokeWidth={isMajor ? 1.6 : 1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Live value arc, glowing */}
          <path
            d={valueD}
            fill="none"
            stroke={status === "normal" ? `url(#gaugeGrad-${label})` : STATUS_SOLID[status]}
            strokeWidth={6}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - Math.max(0, Math.min(100, pct))}
            style={{
              transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.3s ease",
              filter: `drop-shadow(0 0 4px ${STATUS_GLOW[status]})`,
            }}
          />

          {/* Needle */}
          <g
            transform={`rotate(${needleDeg} 50 50)`}
            style={{ transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <polygon points="50,15 47.4,52 52.6,52" fill={STATUS_SOLID[status]} style={{ filter: `drop-shadow(0 0 3px ${STATUS_GLOW[status]})` }} />
            <line x1="50" y1="52" x2="50" y2="61" stroke={STATUS_SOLID[status]} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
          </g>
          <circle cx="50" cy="50" r="4.2" fill="url(#gaugeGrad-hub)" stroke="rgba(0,0,0,0.3)" strokeWidth={0.6} />
          <defs>
            <radialGradient id="gaugeGrad-hub">
              <stop offset="0%" stopColor="#f5f3ff" />
              <stop offset="100%" stopColor="#a78bfa" />
            </radialGradient>
          </defs>
        </svg>

        {/* Digital sub-display window -- the needle's ±130deg sweep never reaches straight
            down (theta=180), so this spot never gets visually crossed by the needle. */}
        <div className="absolute inset-x-0 bottom-[16%] flex justify-center">
          <div className="bg-background/60 rounded-md px-2 py-0.5 border border-input/60">
            <span className={`font-mono font-extrabold tabular-nums ${size === "lg" ? "text-sm" : "text-xs"} ${STATUS_TEXT[status]}`}>
              {displayValue}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

const METRIC_META: Record<MetricKey, { label: string; icon: React.ElementType }> = {
  cpu: { label: "CPU", icon: Cpu },
  ram: { label: "RAM", icon: MemoryStick },
  disk: { label: "Диск", icon: HardDrive },
  network: { label: "Сеть", icon: Wifi },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  server,
  onNavigateTab,
  onRefresh,
  connectionLatencyMs,
}) => {
  const [history, setHistory] = useState<{ cpu: number; ram: number }[]>([]);
  const [selected, setSelected] = useState<MetricKey>("cpu");

  useEffect(() => {
    const ramPct = Math.round((metrics.memory.usedMb / metrics.memory.totalMb) * 100);
    setHistory((prev) => [...prev, { cpu: metrics.cpu.usagePct, ram: ramPct }].slice(-24));
  }, [metrics]);

  const ramPct = Math.round((metrics.memory.usedMb / metrics.memory.totalMb) * 100);
  const ramUsedGb = (metrics.memory.usedMb / 1024).toFixed(1);
  const ramTotalGb = (metrics.memory.totalMb / 1024).toFixed(1);
  const mainDisk = metrics.disk[0] || { usePct: 0, usedGb: 0, sizeGb: 0, availGb: 0, mount: "/", filesystem: "-" };
  const netPct = Math.min(100, ((metrics.network.rxKbps + metrics.network.txKbps) / 2000) * 100);

  const pctFor: Record<MetricKey, number> = {
    cpu: metrics.cpu.usagePct,
    ram: ramPct,
    disk: mainDisk.usePct,
    network: netPct,
  };
  const statusFor: Record<MetricKey, NodeStatus> = {
    cpu: statusOf(pctFor.cpu),
    ram: statusOf(pctFor.ram),
    disk: statusOf(pctFor.disk),
    network: statusOf(pctFor.network),
  };
  const overallStatus: NodeStatus = metrics.connectionError
    ? "danger"
    : (Object.keys(statusFor) as MetricKey[]).some((k) => statusFor[k] === "danger")
    ? "danger"
    : (Object.keys(statusFor) as MetricKey[]).some((k) => statusFor[k] === "warn")
    ? "warn"
    : "normal";

  const QUICK_ACTIONS: { tab: any; label: string; icon: React.ElementType }[] = [
    { tab: "terminal", label: "SSH консоль", icon: Terminal },
    { tab: "files", label: "Файлы", icon: FolderOpen },
    { tab: "processes", label: "Процессы", icon: ListTree },
    { tab: "services", label: "Службы", icon: Server },
    { tab: "firewall", label: "Файрвол", icon: ShieldCheck },
    { tab: "tools", label: "Утилиты", icon: Wrench },
  ];

  const DISPLAY_VALUE: Record<MetricKey, React.ReactNode> = {
    cpu: <AnimatedNumber value={Math.round(pctFor.cpu)} suffix="%" />,
    ram: <AnimatedNumber value={Math.round(pctFor.ram)} suffix="%" />,
    disk: <AnimatedNumber value={Math.round(pctFor.disk)} suffix="%" />,
    network: <AnimatedNumber value={Math.round(pctFor.network)} suffix="%" />,
  };

  return (
    <motion.div
      className="space-y-5 pb-20 lg:pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Multi-info display strip -- hostname / status / uptime / latency, like a car's
          dashboard LCD readout sitting above the analog cluster. */}
      <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${
              overallStatus === "danger" ? "bg-rose-400 animate-pulse" : overallStatus === "warn" ? "bg-amber-400" : "bg-violet-400"
            }`}
          />
          <h2 className="text-sm font-extrabold text-white tracking-tight truncate">{metrics.os.hostname}</h2>
          <span className="hidden sm:inline text-[11px] text-muted-foreground font-mono truncate">
            {metrics.os.distro} · {metrics.os.kernel}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Activity className="w-3 h-3 text-violet-400" />
            {metrics.os.uptime}
            {typeof connectionLatencyMs === "number" && !metrics.connectionError && (
              <span className="text-foreground">· {connectionLatencyMs}мс</span>
            )}
          </span>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground border border-input transition active:scale-95"
            title="Обновить метрики"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* THE CLUSTER -- four analog dials, cockpit-style. Tap a dial to inspect it below. */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div className="grid grid-cols-2 lg:flex lg:items-start lg:justify-center gap-x-2 gap-y-6 lg:gap-x-8">
          {(["disk", "cpu", "ram", "network"] as MetricKey[]).map((k) => (
            <React.Fragment key={k}>
              <GaugeDial
                label={METRIC_META[k].label}
                icon={METRIC_META[k].icon}
                pct={pctFor[k]}
                displayValue={DISPLAY_VALUE[k]}
                status={statusFor[k]}
                size={k === "cpu" || k === "ram" ? "lg" : "md"}
                selected={selected === k}
                onSelect={() => setSelected(k)}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      {metrics.connectionError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-xs text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Не удалось подключиться к удалённому SSH хосту</p>
            <p className="mt-1 font-mono opacity-90">{metrics.connectionError}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Локальные IP (192.168.x.x, 10.x.x.x) недоступны из облачного контейнера. Используйте демо-профиль или
              укажите публичный IP.
            </p>
          </div>
        </div>
      )}

      {/* Console buttons -- quick nav shortcuts, always visible below the cluster. */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {QUICK_ACTIONS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => onNavigateTab(tab)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground border border-input transition active:scale-95"
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Detail panel -- whichever dial is selected. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-3xl p-5 shadow-xl"
        >
          {selected === "cpu" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Загрузка CPU</h3>
                <span className={`text-2xl font-extrabold font-mono tabular-nums ${STATUS_TEXT[statusFor.cpu]}`}>
                  <AnimatedNumber value={metrics.cpu.usagePct} suffix="%" />
                </span>
              </div>
              <Sparkline data={history.map((h) => h.cpu)} color={STATUS_SOLID[statusFor.cpu]} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="bg-background/40 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Ядра</p>
                  <p className="font-mono font-bold text-foreground">{metrics.cpu.cores}</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Модель</p>
                  <p className="font-mono text-foreground truncate">{metrics.cpu.model}</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5 col-span-2">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Load average (1/5/15)</p>
                  <p className="font-mono font-bold text-foreground">{metrics.cpu.loadAvg.join(" / ")}</p>
                </div>
              </div>
            </div>
          )}

          {selected === "ram" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Память ОЗУ</h3>
                <span className={`text-2xl font-extrabold font-mono tabular-nums ${STATUS_TEXT[statusFor.ram]}`}>
                  <AnimatedNumber value={parseFloat(ramUsedGb)} decimals={1} /> / {ramTotalGb}GB
                </span>
              </div>
              <Sparkline data={history.map((h) => h.ram)} color={STATUS_SOLID[statusFor.ram]} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="bg-background/40 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Кэш</p>
                  <p className="font-mono font-bold text-foreground">{metrics.memory.cachedMb}MB</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Свободно</p>
                  <p className="font-mono font-bold text-foreground">{metrics.memory.freeMb}MB</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5 col-span-2 sm:col-span-2">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Swap</p>
                  <p className="font-mono font-bold text-foreground">
                    {metrics.memory.swapUsedMb} / {metrics.memory.swapTotalMb}MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {selected === "disk" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Подключённые тома ({metrics.disk.length})
              </h3>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left text-xs min-w-[420px]">
                  <thead>
                    <tr className="border-b border-input text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                      <th className="py-2 px-1">Точка монтирования</th>
                      <th className="py-2 px-1">ФС</th>
                      <th className="py-2 px-1">Занято</th>
                      <th className="py-2 px-1 text-right">Свободно</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-[11px]">
                    {metrics.disk.map((d, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-1 font-semibold text-foreground">{d.mount}</td>
                        <td className="py-2.5 px-1 text-muted-foreground">{d.filesystem}</td>
                        <td className="py-2.5 px-1 text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-background h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  statusOf(d.usePct) === "danger"
                                    ? "bg-rose-500"
                                    : statusOf(d.usePct) === "warn"
                                    ? "bg-amber-400"
                                    : "bg-violet-400"
                                }`}
                                style={{ width: `${d.usePct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-sans">{d.usePct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-1 text-right text-muted-foreground">{d.availGb}GB / {d.sizeGb}GB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selected === "network" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Трафик сети</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-background/40 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Входящий ↓</p>
                  <p className={`font-mono font-bold ${STATUS_TEXT[statusFor.network]}`}>{metrics.network.rxKbps} KB/s</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Исходящий ↑</p>
                  <p className={`font-mono font-bold ${STATUS_TEXT[statusFor.network]}`}>{metrics.network.txKbps} KB/s</p>
                </div>
                <div className="bg-background/40 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold">Активные сокеты</p>
                  <p className="font-mono font-bold text-foreground">{metrics.network.activeConnections}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
