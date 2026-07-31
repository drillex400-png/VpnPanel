import React, { useState, useEffect, Suspense, lazy } from "react";
import { SystemMetrics, SSHConfig } from "../types";
import {
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Terminal,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

// Lazy-loaded: recharts is one of the heaviest deps in the app and previously shipped in the
// main bundle even when the user never opens the Dashboard tab. Now it's only fetched when
// this graph card actually needs to render.
import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";

const ResourceHistoryChart = lazy(() => import("./ResourceHistoryChart"));

const ChartSkeleton = () => (
  <div className="w-full h-full flex items-end gap-1.5 px-1 pb-1">
    {[40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 50, 85].map((h, i) => (
      <div
        key={i}
        className="flex-1 rounded-t-md bg-white/[0.06] animate-pulse"
        style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
      />
    ))}
  </div>
);

interface DashboardViewProps {
  metrics: SystemMetrics;
  server: SSHConfig;
  onNavigateTab: (tab: any) => void;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  server,
  onNavigateTab,
  onRefresh,
}) => {
  // Real-time metric history for Recharts graph
  const [history, setHistory] = useState<
    { time: string; cpu: number; ramPct: number }[]
  >([]);

  useEffect(() => {
    const ramPct = Math.round(
      (metrics.memory.usedMb / metrics.memory.totalMb) * 100
    );
    const newPoint = {
      time: metrics.timestamp || new Date().toLocaleTimeString().slice(0, 5),
      cpu: metrics.cpu.usagePct,
      ramPct,
    };

    setHistory((prev) => {
      const updated = [...prev, newPoint];
      return updated.slice(-12); // keep last 12 history points
    });
  }, [metrics]);

  const ramUsedGb = (metrics.memory.usedMb / 1024).toFixed(1);
  const ramTotalGb = (metrics.memory.totalMb / 1024).toFixed(1);
  const ramPct = Math.round(
    (metrics.memory.usedMb / metrics.memory.totalMb) * 100
  );

  const mainDisk = metrics.disk[0] || { usePct: 42, usedGb: 42, sizeGb: 100 };

  return (
    <motion.div
      className="space-y-5 pb-20 lg:pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* SSH Connection Alert Banner if live metric connection failed */}
      {metrics.connectionError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-200">Не удалось подключиться к удаленному SSH хосту</h4>
            <p className="mt-1 font-mono text-amber-300/90">{metrics.connectionError}</p>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Примечание: Локальные IP-адреса (<code className="text-amber-300 font-mono">192.168.x.x</code>, <code className="text-amber-300 font-mono">10.x.x.x</code>) недоступны из облачного контейнера. Используйте демо-профиль для тестирования или укажите публичный IP.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner: Server Identity */}
      <div className="bg-gradient-to-r from-slate-900/90 via-[#0d131f] to-slate-900/90 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-slate-800 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/40">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {metrics.os.hostname}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-inner">
                ОНЛАЙН
              </span>
            </div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-1">
              {metrics.os.distro} • Ядро {metrics.os.kernel} ({metrics.os.arch})
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Время работы: <strong className="text-white font-mono">{metrics.os.uptime}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                {metrics.cpu.cores} Ядер ({metrics.cpu.model.split(" ")[0]})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
          <button
            onClick={() => onNavigateTab("terminal")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition active:scale-95"
          >
            <Terminal className="w-4 h-4" />
            SSH Консоль
          </button>
          <button
            onClick={() => onNavigateTab("tools")}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded-2xl border border-white/10 transition active:scale-95"
            title="Системные Утилиты"
          >
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          </button>
        </div>
      </div>

      {/* 4 Core Gauge Widgets Grid matching Elegant Dark mockup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="glass-card rounded-3xl p-4.5 shadow-xl space-y-2 glass-card-hover">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Загрузка CPU
          </p>
          <p className="text-2xl font-bold font-mono text-emerald-400 drop-shadow-sm">
            <AnimatedNumber value={metrics.cpu.usagePct} suffix="%" />
          </p>
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden p-0.5 border border-white/5">
            <motion.div
              className={`h-full rounded-full ${
                metrics.cpu.usagePct > 80
                  ? "bg-rose-500"
                  : metrics.cpu.usagePct > 50
                  ? "bg-amber-400"
                  : "bg-gradient-to-r from-emerald-500 to-teal-400"
              }`}
              animate={{ width: `${metrics.cpu.usagePct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono font-medium">
            <span>{metrics.cpu.cores} vCPUs</span>
            <span>Load: {metrics.cpu.loadAvg[0]}</span>
          </div>
        </div>

        {/* RAM Card */}
        <div className="glass-card rounded-3xl p-4.5 shadow-xl space-y-2 glass-card-hover">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Память ОЗУ
          </p>
          <p className="text-2xl font-bold font-mono text-cyan-400 drop-shadow-sm">
            <AnimatedNumber value={parseFloat(ramUsedGb)} decimals={1} /><span className="text-xs text-slate-400">/{ramTotalGb}GB</span>
          </p>
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden p-0.5 border border-white/5">
            <motion.div
              className={`h-full rounded-full ${
                ramPct > 85 ? "bg-rose-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"
              }`}
              animate={{ width: `${ramPct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono font-medium">
            <span>Кэш: {metrics.memory.cachedMb}MB</span>
            <span>{ramPct}%</span>
          </div>
        </div>

        {/* Disk I/O Card */}
        <div className="glass-card rounded-3xl p-4.5 shadow-xl space-y-2 glass-card-hover">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Занято на Диске
          </p>
          <p className="text-2xl font-bold font-mono text-amber-400 drop-shadow-sm">
            <AnimatedNumber value={mainDisk.usePct} suffix="%" /><span className="text-xs text-slate-400"> ({mainDisk.usedGb}GB)</span>
          </p>
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden p-0.5 border border-white/5">
            <motion.div
              className={`h-full rounded-full ${
                mainDisk.usePct > 85 ? "bg-rose-500" : "bg-gradient-to-r from-amber-500 to-orange-400"
              }`}
              animate={{ width: `${mainDisk.usePct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono font-medium">
            <span>{mainDisk.availGb}GB Свободно</span>
            <span>NVMe SSD</span>
          </div>
        </div>

        {/* Network / Uptime Card */}
        <div className="glass-card rounded-3xl p-4.5 shadow-xl space-y-2 glass-card-hover">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Трафик Сети
          </p>
          <p className="text-2xl font-bold font-mono text-indigo-400 drop-shadow-sm">
            <AnimatedNumber value={metrics.network.txKbps} /><span className="text-xs text-slate-400">KB/s</span>
          </p>
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden p-0.5 border border-white/5">
            <motion.div
              className="bg-gradient-to-r from-indigo-500 to-purple-400 h-full rounded-full"
              animate={{ width: `${Math.min(100, (metrics.network.txKbps / 1200) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono font-medium">
            <span>↓ {metrics.network.rxKbps} KB/s</span>
            <span>{metrics.network.activeConnections} сокетов</span>
          </div>
        </div>
      </div>

      {/* Real-time Graph & Quick Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* History Graph (2 Cols) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Монитор Ресурсов в Реальном Времени
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                График динамики CPU (%) и оперативной памяти (%)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" /> CPU
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" /> RAM
              </span>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            <Suspense fallback={<ChartSkeleton />}>
              <ResourceHistoryChart history={history} />
            </Suspense>
          </div>
        </div>

        {/* Server Shortcuts & Quick Navigation */}
        <div className="glass-card rounded-3xl p-5 shadow-2xl space-y-3 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              Быстрые Ярлыки
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Быстрый переход к разделам управления сервером
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigateTab("files")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 transition group text-xs text-slate-200 active:scale-98"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <HardDrive className="w-3.5 h-3.5" />
                  </span>
                  Файловый менеджер (/var/www, /etc)
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onNavigateTab("processes")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 transition group text-xs text-slate-200 active:scale-98"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Cpu className="w-3.5 h-3.5" />
                  </span>
                  Диспетчер процессов (htop)
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onNavigateTab("services")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 transition group text-xs text-slate-200 active:scale-98"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  Службы Systemd и Демоны
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onNavigateTab("firewall")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 transition group text-xs text-slate-200 active:scale-98"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </span>
                  Файрвол UFW и Открытые Порты
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#242424] flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>SSH: Ed25519</span>
            <span className="text-emerald-400 font-medium font-sans">Защищенная сессия</span>
          </div>
        </div>
      </div>

      {/* Disks & File Systems Table */}
      <div className="bg-[#171717] border border-[#242424] rounded-3xl p-5 shadow-xl space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          Подключенные Дисковые Тома ({metrics.disk.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead>
              <tr className="border-b border-[#242424] text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                <th className="py-2.5 px-3">Точка монтирования</th>
                <th className="py-2.5 px-3">Файловая система</th>
                <th className="py-2.5 px-3">Объем</th>
                <th className="py-2.5 px-3">Занято</th>
                <th className="py-2.5 px-3 text-right">Свободно</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424] font-mono text-[11px]">
              {metrics.disk.map((d, i) => (
                <tr key={i} className="hover:bg-[#202020] transition">
                  <td className="py-3 px-3 font-semibold text-emerald-400">
                    {d.mount}
                  </td>
                  <td className="py-3 px-3 text-gray-500">{d.filesystem}</td>
                  <td className="py-3 px-3 text-gray-300">
                    {d.usedGb} / {d.sizeGb} GB
                  </td>
                  <td className="py-3 px-3 w-40">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            d.usePct > 80 ? "bg-rose-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${d.usePct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-sans">
                        {d.usePct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-semibold">
                    {d.availGb} GB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
