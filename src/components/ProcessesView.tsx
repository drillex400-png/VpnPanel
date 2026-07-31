import React, { useState, useEffect } from "react";
import { ProcessItem, SSHConfig } from "../types";
import { INITIAL_PROCESSES, execCommand } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import {
  Cpu,
  Search,
  Zap,
  Power,
  RefreshCw,
  X,
  Sliders,
  AlertCircle,
  Activity,
  Terminal,
} from "lucide-react";

interface ProcessesViewProps {
  server: SSHConfig;
}

export const ProcessesView: React.FC<ProcessesViewProps> = ({ server }) => {
  const toast = useToast();
  const [processes, setProcesses] = useState<ProcessItem[]>(INITIAL_PROCESSES);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"cpuPct" | "memPct" | "pid">("cpuPct");
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
  const [reniceValue, setReniceValue] = useState(0);

  const fetchProcesses = async () => {
    setIsLoading(true);
    try {
      const res = await execCommand(server, "ps aux");
      if (res && res.stdout) {
        const lines = res.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsed: ProcessItem[] = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("USER") || line.startsWith("PID")) continue;
          const parts = line.split(/\s+/);
          if (parts.length >= 11) {
            const user = parts[0];
            const pid = parseInt(parts[1], 10);
            if (isNaN(pid)) continue;
            const cpuPct = parseFloat(parts[2]) || 0;
            const memPct = parseFloat(parts[3]) || 0;
            const vszRaw = parts[4];
            const rssRaw = parts[5];
            const tty = parts[6];
            const stat = parts[7];
            const start = parts[8];
            const time = parts[9];
            const command = parts.slice(10).join(" ");

            const formatKb = (kbStr: string) => {
              const num = parseInt(kbStr, 10);
              if (isNaN(num)) return kbStr;
              if (num > 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)}G`;
              if (num > 1024) return `${(num / 1024).toFixed(1)}M`;
              return `${num}K`;
            };

            parsed.push({
              pid,
              user,
              cpuPct,
              memPct,
              vsz: formatKb(vszRaw),
              rss: formatKb(rssRaw),
              tty,
              stat,
              start,
              time,
              command,
            });
          }
        }
        if (parsed.length > 0) {
          setProcesses(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to fetch live processes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [server.id, server.host]);

  // Filter & sort
  const filtered = processes
    .filter(
      (p) =>
        p.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pid.toString().includes(searchQuery)
    )
    .sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  // `kill -0 <pid>` sends no actual signal -- it only checks whether the pid still exists
  // and is owned by us. Used here to verify a signal actually had its expected effect
  // instead of assuming success from the command's exit code alone.
  const checkPidAlive = async (pid: number): Promise<boolean> => {
    const res = await execCommand(server, `kill -0 ${pid} 2>/dev/null && echo ALIVE || echo DEAD`);
    return res.stdout.includes("ALIVE");
  };

  const handleSendSignal = async (signal: string) => {
    if (!selectedProcess) return;
    const proc = selectedProcess;
    setSelectedProcess(null);

    await execCommand(server, `kill -${signal} ${proc.pid}`);
    // Give the process a brief moment to react before we re-check its status.
    await new Promise((r) => setTimeout(r, 600));
    const stillAlive = await checkPidAlive(proc.pid);

    if (signal === "9") {
      // SIGKILL cannot be caught or ignored -- the process must be gone by now.
      if (!stillAlive) {
        setProcesses((prev) => prev.filter((p) => p.pid !== proc.pid));
        toast.success("Процесс завершён", `SIGKILL → PID ${proc.pid} (${proc.command})`);
      } else {
        toast.error("Не удалось завершить", `PID ${proc.pid} всё ещё жив после SIGKILL — проверь права`);
      }
    } else if (signal === "15") {
      // SIGTERM is a request -- the process may ignore it or take longer to exit gracefully.
      if (!stillAlive) {
        setProcesses((prev) => prev.filter((p) => p.pid !== proc.pid));
        toast.success("Процесс завершён", `SIGTERM → PID ${proc.pid} (${proc.command})`);
      } else {
        toast.warning("Процесс не завершился", `PID ${proc.pid} проигнорировал SIGTERM или ещё завершается — попробуй SIGKILL`);
      }
    } else {
      // SIGHUP (1): normally used to reload config, process should still be running.
      if (stillAlive) {
        toast.success("Сигнал отправлен", `SIGHUP → PID ${proc.pid} (${proc.command}), процесс жив`);
      } else {
        toast.warning("Процесс завершился", `PID ${proc.pid} не пережил SIGHUP (не поддерживает reload)`);
        setProcesses((prev) => prev.filter((p) => p.pid !== proc.pid));
      }
    }
  };

  const handleApplyRenice = async () => {
    if (!selectedProcess) return;
    const proc = selectedProcess;
    const targetValue = reniceValue;
    setSelectedProcess(null);

    await execCommand(server, `renice -n ${targetValue} -p ${proc.pid}`);
    // Verify the actual nice value on the process instead of trusting the exit code --
    // renice silently no-ops without root on some setups.
    const res = await execCommand(server, `ps -o ni= -p ${proc.pid}`);
    const actualNice = parseInt(res.stdout.trim(), 10);

    if (!isNaN(actualNice) && actualNice === targetValue) {
      toast.success("Приоритет изменён", `PID ${proc.pid} → nice ${targetValue}`);
    } else if (!isNaN(actualNice)) {
      toast.error("Приоритет не применился", `PID ${proc.pid}: запрошено ${targetValue}, фактически ${actualNice} (нужны права root?)`);
    } else {
      toast.error("Не удалось проверить приоритет", `PID ${proc.pid} мог уже завершиться`);
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Banner & Filters */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-400" />
              Диспетчер Процессов (Визуализатор htop)
            </h2>
            <p className="text-xs text-gray-400">
              Активные процессы на {server.name} ({filtered.length} отображается)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={fetchProcesses}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#202020] text-violet-400 border border-[#242424] rounded-xl font-semibold transition disabled:opacity-50 mr-1"
              title="Обновить список процессов"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>
            <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-widest hidden sm:inline">Сортировка:</span>
            <button
              onClick={() => setSortBy("cpuPct")}
              className={`px-3 py-1.5 rounded-xl transition ${
                sortBy === "cpuPct"
                  ? "bg-violet-600 text-white font-semibold"
                  : "bg-[#171717] text-gray-400 hover:bg-[#202020]"
              }`}
            >
              CPU %
            </button>
            <button
              onClick={() => setSortBy("memPct")}
              className={`px-3 py-1.5 rounded-xl transition ${
                sortBy === "memPct"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-[#171717] text-gray-400 hover:bg-[#202020]"
              }`}
            >
              ОЗУ %
            </button>
            <button
              onClick={() => setSortBy("pid")}
              className={`px-3 py-1.5 rounded-xl transition ${
                sortBy === "pid"
                  ? "bg-[#242424] text-white font-semibold"
                  : "bg-[#171717] text-gray-400 hover:bg-[#202020]"
              }`}
            >
              PID
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Фильтр процессов по имени, PID или пользователю (например: nginx, postgres)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#171717] border border-[#242424] rounded-2xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      {/* Process Table */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl shadow-2xl p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead>
              <tr className="border-b border-[#242424] text-[10px] text-gray-500 uppercase font-bold tracking-widest bg-[#171717]">
                <th className="py-2.5 px-3">PID</th>
                <th className="py-2.5 px-3">Пользователь</th>
                <th className="py-2.5 px-3">CPU %</th>
                <th className="py-2.5 px-3">ОЗУ %</th>
                <th className="py-2.5 px-3">RSS</th>
                <th className="py-2.5 px-3">Команда</th>
                <th className="py-2.5 px-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424] font-mono text-[11px]">
              {filtered.map((proc) => (
                <tr
                  key={proc.pid}
                  onClick={() => setSelectedProcess(proc)}
                  className="hover:bg-[#171717] transition cursor-pointer group"
                >
                  <td className="py-2.5 px-3 font-semibold text-violet-400">
                    {proc.pid}
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 font-sans">{proc.user}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`font-semibold ${
                        proc.cpuPct > 10 ? "text-amber-400" : "text-violet-400"
                      }`}
                    >
                      {proc.cpuPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`font-semibold ${
                        proc.memPct > 10 ? "text-rose-400" : "text-blue-400"
                      }`}
                    >
                      {proc.memPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">{proc.rss}</td>
                  <td className="py-2.5 px-3 font-sans text-xs text-gray-200 font-medium truncate max-w-xs sm:max-sm">
                    {proc.command}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProcess(proc);
                      }}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold transition"
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Control Modal */}
      {selectedProcess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-[#242424] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#242424] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Cpu className="w-5 h-5 text-violet-400" />
                Управление процессом: PID {selectedProcess.pid}
              </div>
              <button
                onClick={() => setSelectedProcess(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#171717] p-3.5 rounded-2xl border border-[#242424] space-y-1 font-mono text-xs text-gray-300">
              <div>
                Команда: <strong className="text-violet-400">{selectedProcess.command}</strong>
              </div>
              <div className="text-[11px] text-gray-400 flex flex-wrap gap-4">
                <span>Пользователь: {selectedProcess.user}</span>
                <span>CPU: {selectedProcess.cpuPct}%</span>
                <span>ОЗУ: {selectedProcess.memPct}% ({selectedProcess.rss})</span>
              </div>
            </div>

            {/* Signal Buttons */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-semibold">Отправить сигнал POSIX</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleSendSignal("9")}
                  className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center"
                >
                  <span>SIGKILL (9)</span>
                  <span className="text-[9px] text-rose-400/80 font-normal">Принудительно</span>
                </button>
                <button
                  onClick={() => handleSendSignal("15")}
                  className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center"
                >
                  <span>SIGTERM (15)</span>
                  <span className="text-[9px] text-amber-400/80 font-normal">Завершить мягко</span>
                </button>
                <button
                  onClick={() => handleSendSignal("1")}
                  className="p-2.5 bg-[#171717] hover:bg-[#202020] text-violet-400 border border-[#2d2d2d] rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center"
                >
                  <span>SIGHUP (1)</span>
                  <span className="text-[9px] text-gray-400 font-normal">Обновить конфиг</span>
                </button>
              </div>
            </div>

            {/* Renice priority */}
            <div className="space-y-2 pt-2 border-t border-[#242424]">
              <label className="text-xs text-gray-400 font-semibold flex items-center justify-between">
                <span>Приоритет Renice (-20 высокий, +19 низкий)</span>
                <span className="text-violet-400 font-mono">{reniceValue}</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-20"
                  max="19"
                  value={reniceValue}
                  onChange={(e) => setReniceValue(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <button
                  onClick={handleApplyRenice}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shrink-0"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
