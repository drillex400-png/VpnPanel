import React, { useState, useEffect, useMemo } from "react";
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

type NodeKey = "hub" | "cpu" | "ram" | "disk" | "network";
type NodeStatus = "normal" | "warn" | "danger";

interface NodeConfig {
  key: NodeKey;
  cx: number;
  cy: number;
  r: number;
}

interface LayoutConfig {
  vbW: number;
  vbH: number;
  nodes: Record<NodeKey, NodeConfig>;
  edges: [NodeKey, NodeKey][];
}

// Desktop: classic hub-and-spoke -- the server is the hub, every resource is a satellite
// wired directly to it. Mobile: a single vertical spine (hub -> cpu -> ram -> disk -> network)
// since a wide radial star has no room to breathe under ~380px -- still a connected node
// graph, just laid out top-to-bottom instead of compass points.
function buildLayout(isDesktop: boolean): LayoutConfig {
  if (isDesktop) {
    return {
      vbW: 400,
      vbH: 260,
      nodes: {
        hub: { key: "hub", cx: 200, cy: 130, r: 42 },
        cpu: { key: "cpu", cx: 200, cy: 34, r: 32 },
        ram: { key: "ram", cx: 352, cy: 130, r: 32 },
        disk: { key: "disk", cx: 200, cy: 226, r: 32 },
        network: { key: "network", cx: 48, cy: 130, r: 32 },
      },
      edges: [
        ["hub", "cpu"],
        ["hub", "ram"],
        ["hub", "disk"],
        ["hub", "network"],
      ],
    };
  }
  return {
    vbW: 220,
    vbH: 480,
    nodes: {
      hub: { key: "hub", cx: 110, cy: 46, r: 34 },
      cpu: { key: "cpu", cx: 110, cy: 148, r: 28 },
      ram: { key: "ram", cx: 110, cy: 240, r: 28 },
      disk: { key: "disk", cx: 110, cy: 332, r: 28 },
      network: { key: "network", cx: 110, cy: 424, r: 28 },
    },
    edges: [
      ["hub", "cpu"],
      ["cpu", "ram"],
      ["ram", "disk"],
      ["disk", "network"],
    ],
  };
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

function statusOf(pct: number): NodeStatus {
  if (pct > 80) return "danger";
  if (pct > 50) return "warn";
  return "normal";
}

const STATUS_STROKE: Record<NodeStatus, string> = {
  normal: "url(#nodeGradNormal)",
  warn: "#fbbf24",
  danger: "#f43f5e",
};
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

/** One ring + traveling pulse particle for a single node/edge, driven off the shared <defs>. */
function ProgressRing({ cx, cy, r, pct, status }: { cx: number; cy: number; r: number; pct: number; status: NodeStatus }) {
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={STATUS_STROKE[status]}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={false}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </g>
  );
}

const NODE_META: Record<Exclude<NodeKey, "hub">, { label: string; icon: React.ElementType }> = {
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
  const isDesktop = useIsDesktop();
  const layout = useMemo(() => buildLayout(isDesktop), [isDesktop]);

  const [history, setHistory] = useState<{ cpu: number; ram: number }[]>([]);
  const [selected, setSelected] = useState<NodeKey>("hub");

  useEffect(() => {
    const ramPct = Math.round((metrics.memory.usedMb / metrics.memory.totalMb) * 100);
    setHistory((prev) => [...prev, { cpu: metrics.cpu.usagePct, ram: ramPct }].slice(-24));
  }, [metrics]);

  // If the SSH link drops, pull focus back to the hub so the error is never buried behind
  // whatever node the user happened to be inspecting.
  useEffect(() => {
    if (metrics.connectionError) setSelected("hub");
  }, [metrics.connectionError]);

  const ramPct = Math.round((metrics.memory.usedMb / metrics.memory.totalMb) * 100);
  const ramUsedGb = (metrics.memory.usedMb / 1024).toFixed(1);
  const ramTotalGb = (metrics.memory.totalMb / 1024).toFixed(1);
  const mainDisk = metrics.disk[0] || { usePct: 0, usedGb: 0, sizeGb: 0, availGb: 0, mount: "/", filesystem: "-" };
  const netPct = Math.min(100, ((metrics.network.rxKbps + metrics.network.txKbps) / 2000) * 100);

  const pctFor: Record<Exclude<NodeKey, "hub">, number> = {
    cpu: metrics.cpu.usagePct,
    ram: ramPct,
    disk: mainDisk.usePct,
    network: netPct,
  };
  const statusFor: Record<Exclude<NodeKey, "hub">, NodeStatus> = {
    cpu: statusOf(pctFor.cpu),
    ram: statusOf(pctFor.ram),
    disk: statusOf(pctFor.disk),
    network: statusOf(pctFor.network),
  };
  const hubStatus: NodeStatus = metrics.connectionError
    ? "danger"
    : (["cpu", "ram", "disk", "network"] as const).some((k) => statusFor[k] === "danger")
    ? "danger"
    : (["cpu", "ram", "disk", "network"] as const).some((k) => statusFor[k] === "warn")
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

  return (
    <motion.div
      className="space-y-5 pb-20 lg:pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Slim identity bar -- hostname + status + refresh. No card chrome; the map below is
          the visual centerpiece, not another gradient banner competing with it. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-white tracking-tight truncate">{metrics.os.hostname}</h2>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              hubStatus === "danger"
                ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                : hubStatus === "warn"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-violet-500/15 text-violet-300 border-violet-500/30"
            }`}
          >
            {hubStatus === "danger" ? "ВНИМАНИЕ" : hubStatus === "warn" ? "НАГРУЗКА" : "ОНЛАЙН"}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 p-2 rounded-xl bg-card text-muted-foreground hover:text-foreground border border-input transition active:scale-95"
          title="Обновить метрики"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* THE MAP -- server as hub, resources as connected satellite nodes. Click any node to
          inspect it below; the connecting lines carry an animated pulse whose speed reflects
          that resource's live load. */}
      <div className="glass-card rounded-3xl p-3 sm:p-5 shadow-2xl">
        <div
          className="relative mx-auto w-full"
          style={{ maxWidth: isDesktop ? 640 : 320, aspectRatio: `${layout.vbW} / ${layout.vbH}` }}
        >
          <svg
            viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="nodeGradNormal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#e879f9" />
              </linearGradient>
            </defs>

            {/* Edges + traveling pulse particles */}
            {layout.edges.map(([a, b]) => {
              const from = layout.nodes[a];
              const to = layout.nodes[b];
              const targetStatus = b === "hub" ? hubStatus : statusFor[b as Exclude<NodeKey, "hub">];
              const pathId = `edge-${a}-${b}`;
              const pct = b === "hub" ? 0 : pctFor[b as Exclude<NodeKey, "hub">];
              const dur = Math.max(0.7, 2.4 - (pct / 100) * 1.6);
              return (
                <g key={pathId}>
                  <path
                    id={pathId}
                    d={`M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`}
                    fill="none"
                    stroke={STATUS_SOLID[targetStatus]}
                    strokeOpacity={0.35}
                    strokeWidth={2}
                  />
                  <circle r={3} fill={STATUS_SOLID[targetStatus]}>
                    <animateMotion dur={`${dur}s`} repeatCount="indefinite">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

            {/* Progress rings for every node (hub included -- reflects worst-case status) */}
            <ProgressRing {...layout.nodes.hub} pct={hubStatus === "normal" ? 8 : hubStatus === "warn" ? 55 : 92} status={hubStatus} />
            {(["cpu", "ram", "disk", "network"] as const).map((k) => (
              <ProgressRing key={k} {...layout.nodes[k]} pct={pctFor[k]} status={statusFor[k]} />
            ))}
          </svg>

          {/* HTML overlays: icons/labels/values, positioned on the same logical grid as the SVG */}
          {(Object.keys(layout.nodes) as NodeKey[]).map((key) => {
            const n = layout.nodes[key];
            const left = (n.cx / layout.vbW) * 100;
            const top = (n.cy / layout.vbH) * 100;
            const isHub = key === "hub";
            const status = isHub ? hubStatus : statusFor[key as Exclude<NodeKey, "hub">];
            const Icon = isHub ? Server : NODE_META[key as Exclude<NodeKey, "hub">].icon;
            const isSelected = selected === key;
            const sizePx = isHub ? (isDesktop ? 74 : 56) : isDesktop ? 56 : 44;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <span
                  className="relative flex items-center justify-center rounded-full transition-transform group-active:scale-95"
                  style={{ width: sizePx, height: sizePx }}
                >
                  {status === "danger" && (
                    <span className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
                  )}
                  <span
                    className={`absolute inset-1 rounded-full bg-card border ${
                      isSelected ? "border-primary ring-2 ring-ring/50" : "border-input"
                    } shadow-lg flex items-center justify-center`}
                  >
                    <Icon className={`${isHub ? "w-6 h-6" : "w-4 h-4 sm:w-5 sm:h-5"} ${STATUS_TEXT[status]}`} />
                  </span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {isHub ? "Сервер" : NODE_META[key as Exclude<NodeKey, "hub">].label}
                </span>
                {!isHub && (
                  <span className={`text-[10px] sm:text-xs font-mono font-bold tabular-nums ${STATUS_TEXT[status]}`}>
                    <AnimatedNumber value={Math.round(pctFor[key as Exclude<NodeKey, "hub">])} suffix="%" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel -- shows whichever node is selected. Replaces the old always-on card
          grid + permanent chart + permanent disk table with one focused inspector. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-3xl p-5 shadow-xl"
        >
          {selected === "hub" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  {metrics.os.distro} • Ядро {metrics.os.kernel} ({metrics.os.arch})
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Аптайм: <strong className="text-foreground">{metrics.os.uptime}</strong>
                </span>
              </div>

              {metrics.connectionError ? (
                <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-xs text-destructive flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Не удалось подключиться к удалённому SSH хосту</p>
                    <p className="mt-1 font-mono opacity-90">{metrics.connectionError}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Локальные IP (192.168.x.x, 10.x.x.x) недоступны из облачного контейнера. Используйте демо-профиль
                      или укажите публичный IP.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  SSH-сессия активна
                  {typeof connectionLatencyMs === "number" && (
                    <span className="font-mono text-foreground">· {connectionLatencyMs}мс</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
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
            </div>
          )}

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
                        <td className="py-2.5 px-1 w-36">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-background/60 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${d.usePct > 80 ? "bg-destructive" : "bg-primary"}`}
                                style={{ width: `${d.usePct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-sans">{d.usePct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-1 text-right text-foreground font-semibold">{d.availGb}GB</td>
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
