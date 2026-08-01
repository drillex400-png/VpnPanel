import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ServiceItem, SSHConfig } from "../types";
import { execCommand } from "../services/api";
import { shQuote } from "../utils/shellQuote";
import { useToast } from "../contexts/ToastContext";
import {
  Boxes,
  Play,
  Square,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  X,
  RefreshCw,
  Terminal,
} from "lucide-react";

interface ServicesViewProps {
  server: SSHConfig;
}

// systemd unit names are parsed from `systemctl list-units` output, not raw free
// text, but we still validate the shape before ever building a shell command with
// them (defense in depth -- a compromised/weird remote output should fail closed,
// not get shell-interpreted).
const isSafeUnitName = (unit: string): boolean => /^[A-Za-z0-9@:_.\\-]+\.service$/.test(unit);

export const ServicesView: React.FC<ServicesViewProps> = ({ server }) => {
  const toast = useToast();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<"all" | "active" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLogService, setActiveLogService] = useState<ServiceItem | null>(null);
  const [journalLogs, setJournalLogs] = useState("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await execCommand(server, "systemctl list-units --type=service --no-pager --no-legend");
      if (res && res.stdout) {
        const lines = res.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsed: ServiceItem[] = [];
        for (const line of lines) {
          const match = line.match(/^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
          if (match) {
            const [, unit, load, active, sub, description] = match;
            const name = unit.replace(".service", "");
            parsed.push({ name, unit, load, active, sub, description });
          }
        }
        if (parsed.length > 0) {
          setServices(parsed);
          setFetchError(null);
        } else {
          // Don't silently keep showing whatever was on screen before as if it were current --
          // surface it so the user knows this isn't live data right now.
          setFetchError("Не удалось разобрать вывод `systemctl list-units`");
          toast.error("Не удалось получить список служб", "Сервер вернул неожиданный формат вывода");
        }
      } else {
        setFetchError(res?.stderr || "Сервер не вернул данные");
        toast.error("Не удалось получить список служб", res?.stderr || "Пустой ответ от сервера");
      }
    } catch (e: any) {
      console.error("Failed to fetch services:", e);
      setFetchError(e?.message || "Ошибка подключения к серверу");
      toast.error("Не удалось получить список служб", e?.message || "Ошибка подключения к серверу");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  React.useEffect(() => {
    fetchServices();
  }, [server.id, server.host]);

  const filtered = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterState === "active") return matchesSearch && s.active === "active";
    if (filterState === "failed") return matchesSearch && s.active === "failed";
    return matchesSearch;
  });

  // Queries real systemd state instead of trusting the command's exit code -- systemctl can
  // exit 0 even when the unit fails to actually reach the requested state (e.g. missing
  // sudo rights, a crash-looping service, a masked unit).
  const getServiceStatus = async (unit: string): Promise<{ active: string; sub: string }> => {
    if (!isSafeUnitName(unit)) return { active: "unknown", sub: "unknown" };
    const res = await execCommand(server, `systemctl show -- ${shQuote(unit)} --property=ActiveState,SubState --value`);
    const [active, sub] = res.stdout.trim().split("\n").map((s) => s.trim());
    return { active: active || "unknown", sub: sub || "unknown" };
  };

  const actionLabels: Record<"start" | "stop" | "restart", string> = {
    start: "запущена",
    stop: "остановлена",
    restart: "перезапущена",
  };

  const handleServiceAction = async (service: ServiceItem, action: "start" | "stop" | "restart") => {
    if (!isSafeUnitName(service.unit)) {
      toast.error("Недопустимое имя службы", `"${service.unit}" не похоже на корректный systemd unit`);
      return;
    }
    await execCommand(server, `sudo systemctl ${action} -- ${shQuote(service.unit)}`);
    // Small delay -- systemd needs a moment to settle into its final state, especially restart.
    await new Promise((r) => setTimeout(r, 800));
    const { active, sub } = await getServiceStatus(service.unit);

    setServices((prev) =>
      prev.map((s) => (s.name === service.name ? { ...s, active, sub } : s))
    );

    const expectedActive = action === "stop" ? active !== "active" : active === "active";
    if (expectedActive) {
      toast.success(`Служба ${actionLabels[action]}`, `${service.unit} → ${active}/${sub}`);
    } else {
      toast.error(
        `Не удалось выполнить ${action}`,
        `${service.unit} осталась в состоянии ${active}/${sub} (проверь права sudo или sing-box/xray journalctl)`
      );
    }
  };

  const handleOpenJournal = async (service: ServiceItem) => {
    setActiveLogService(service);
    setIsLoadingLogs(true);
    if (!isSafeUnitName(service.unit)) {
      setIsLoadingLogs(false);
      setJournalLogs("Недопустимое имя службы -- журнал не запрошен.");
      return;
    }
    const res = await execCommand(server, `sudo journalctl -u ${shQuote(service.unit)} -n 30 --no-pager`);
    setIsLoadingLogs(false);
    if (res.stdout && res.stdout.trim()) {
      setJournalLogs(res.stdout);
    } else if (res.stderr && res.stderr.trim()) {
      setJournalLogs(`(журнал пуст, stderr) ${res.stderr}`);
    } else {
      setJournalLogs("Журнал пуст -- для этой службы пока нет записей в journalctl.");
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-purple-400" />
              Службы Systemd и Демоны
            </h2>
            <p className="text-xs text-slate-400">
              Управление фоновыми службами и просмотр логов journalctl
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button
              onClick={fetchServices}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 rounded-xl font-semibold transition disabled:opacity-50"
              title="Обновить список служб"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>
            <button
              onClick={() => setFilterState("all")}
              className={`px-3 py-1.5 rounded-xl transition font-medium ${
                filterState === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Все ({services.length})
            </button>
            <button
              onClick={() => setFilterState("active")}
              className={`px-3 py-1.5 rounded-xl transition font-medium ${
                filterState === "active"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Активные ({services.filter((s) => s.active === "active").length})
            </button>
            <button
              onClick={() => setFilterState("failed")}
              className={`px-3 py-1.5 rounded-xl transition font-medium ${
                filterState === "failed"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Сбои ({services.filter((s) => s.active === "failed").length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Поиск служб (nginx, docker, postgres, ssh)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
          />
        </div>
      </div>

      {/* Services List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs">
            {!hasLoadedOnce
              ? "Загрузка служб…"
              : fetchError
              ? `⚠ ${fetchError}`
              : searchQuery
              ? "Ничего не найдено по фильтру"
              : "Службы не найдены"}
          </div>
        )}
        {filtered.map((srv, idx) => {
          const isActive = srv.active === "active";
          const isFailed = srv.active === "failed";

          return (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isActive
                          ? "bg-violet-400 animate-pulse"
                          : isFailed
                          ? "bg-rose-500"
                          : "bg-slate-500"
                      }`}
                    />
                    <h3 className="font-bold text-sm text-white">{srv.name}</h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isActive
                        ? "bg-violet-950 text-violet-400 border border-violet-800/60"
                        : isFailed
                        ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {srv.active}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                  {srv.description}
                </p>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {srv.unit} • {srv.sub}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {isActive ? (
                    <button
                      onClick={() => handleServiceAction(srv, "stop")}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition"
                      title="Остановить службу"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleServiceAction(srv, "start")}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-violet-400 rounded-lg border border-slate-700 transition"
                      title="Запустить службу"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleServiceAction(srv, "restart")}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-fuchsia-400 rounded-lg border border-slate-700 transition"
                    title="Перезапустить службу"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleOpenJournal(srv)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  Логи Journal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Journalctl Logs Modal */}
      {activeLogService &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl h-[85vh] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden my-auto">
              <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                  <div className="truncate">
                    <h3 className="font-bold text-xs sm:text-sm text-white truncate">
                      Journalctl: {activeLogService.unit}
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate">
                      Показано 30 последних записей journalctl
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveLogService(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 bg-slate-950 p-3 sm:p-4 font-mono text-[11px] sm:text-xs text-violet-400 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {isLoadingLogs ? "Загрузка логов по SSH..." : journalLogs}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
