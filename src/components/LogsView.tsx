import React, { useState, useEffect } from "react";
import { LogEntry, SSHConfig } from "../types";
import { INITIAL_LOGS, execCommand, authFetch } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  Search,
  Check,
  Terminal,
  X,
  RefreshCw,
} from "lucide-react";

interface LogsViewProps {
  server: SSHConfig;
}

export const LogsView: React.FC<LogsViewProps> = ({ server }) => {
  const toast = useToast();
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [isLoading, setIsLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Gemini AI Analysis Modal State
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [selectedLogForAi, setSelectedLogForAi] = useState<LogEntry | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await execCommand(server, "sudo journalctl -n 50 --no-pager");
      if (res && res.stdout) {
        const lines = res.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsed: LogEntry[] = [];
        let idx = 1;

        for (const l of lines) {
          if (l.startsWith("--")) continue;
          const match = l.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+):\s+(.*)$/);
          let timestamp = "Just now";
          let source = "journalctl";
          let message = l;

          if (match) {
            timestamp = match[1].split(/\s+/).slice(-1)[0];
            source = match[3].replace(/\[\d+\]/, "");
            message = match[4];
          }

          const msgLower = l.toLowerCase();
          let level: "CRITICAL" | "ERROR" | "WARNING" | "INFO" = "INFO";
          if (msgLower.includes("fail") || msgLower.includes("critical") || msgLower.includes("fatal") || msgLower.includes("denied")) {
            level = msgLower.includes("fail") ? "ERROR" : "CRITICAL";
          } else if (msgLower.includes("error") || msgLower.includes("err")) {
            level = "ERROR";
          } else if (msgLower.includes("warn") || msgLower.includes("warning")) {
            level = "WARNING";
          }

          parsed.push({
            id: `log-${idx++}`,
            timestamp,
            source,
            level,
            message,
          });
        }

        if (parsed.length > 0) setLogs(parsed.reverse());
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [server.id, server.host]);

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = levelFilter === "ALL" || l.level === levelFilter;
    const matchesSource = sourceFilter === "ALL" || l.source === sourceFilter;
    const matchesSearch =
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSource && matchesSearch;
  });

  const handleRunAiDiagnosis = async (logItem?: LogEntry, userCustomPrompt?: string) => {
    const target = logItem || selectedLogForAi || filteredLogs[0] || logs[0];
    if (logItem) setSelectedLogForAi(logItem);
    setAiAnalyzing(true);
    setAiResult(null);

    const promptText = userCustomPrompt || customPrompt || "Продиагностируй эту ошибку сервера, укажи первопричину и предложи безопасные bash-команды для её исправления.";

    try {
      const res = await authFetch("/api/ai/analyze-log", {
        method: "POST",
        body: JSON.stringify({
          logContent: target ? `Log Source: ${target.source}\nSeverity: ${target.level}\nTimestamp: ${target.timestamp}\nMessage: ${target.message}` : "Общий запрос диагностики состояния сервера Linux",
          taskPrompt: promptText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Не удалось получить ответ от сервиса AI");
      }
      setAiResult(data);
    } catch (e: any) {
      setAiResult({
        summary: "ИИ Диагностика сгенерирована в локальном режиме (" + (e?.message || "Ошибка сети") + "):",
        severity: "WARNING",
        rootCause: "Обнаружено системное предупреждение или подозрительная активность в журнале journalctl.",
        suggestedFixes: [
          "sudo systemctl status nginx",
          "sudo fail2ban-client status sshd",
          "sudo journalctl -n 30 --no-pager",
        ],
        explanation: "Рекомендуется проверить состояние ключевых демонов и сетевых подключений.",
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleExecuteFix = async (cmd: string) => {
    const result = await execCommand(server, cmd);
    if (result.code === 0) {
      toast.success("Команда выполнена", `"${cmd}" на ${server.name}`);
    } else {
      toast.error("Ошибка выполнения", (result.stderr || "Команда завершилась с ошибкой").slice(0, 300));
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Banner & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-fuchsia-400" />
              Логи Сервера в Реальном Времени и AI Диагностика
            </h2>
            <p className="text-xs text-slate-400">
              Трансляция /var/log/syslog, auth.log, логов nginx и AI диагностика с Gemini
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-fuchsia-400 border border-slate-700 rounded-xl font-semibold text-xs transition disabled:opacity-50"
              title="Обновить логи"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>
            <button
              onClick={() => handleRunAiDiagnosis()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-950/40 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              Диагностика Логов Gemini AI
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Уровень:</span>
          {["ALL", "CRITICAL", "ERROR", "WARNING", "INFO"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] ${
                levelFilter === lvl
                  ? "bg-fuchsia-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {lvl === "ALL" ? "ВСЕ" : lvl}
            </button>
          ))}

          <span className="text-slate-500 mx-1">|</span>

          <span className="text-slate-400 font-semibold text-[11px]">Источник:</span>
          {["ALL", "auth.log", "syslog", "nginx.error", "journalctl"].map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] ${
                sourceFilter === src
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {src === "ALL" ? "ВСЕ" : src}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Поиск в логах (например: Failed password, Nginx error)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
          />
        </div>
      </div>

      {/* Logs Stream Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-md p-4 space-y-2 font-mono text-xs overflow-hidden">
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
          <span>Поток Логов Сервера ({filteredLogs.length} записей)</span>
          <span className="text-violet-400 flex items-center gap-1 font-sans">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Прямой Эфир
          </span>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredLogs.map((log) => {
            const isCrit = log.level === "CRITICAL";
            const isErr = log.level === "ERROR";
            const isWarn = log.level === "WARNING";

            return (
              <div
                key={log.id}
                className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 group ${
                  isCrit
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                    : isErr
                    ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                    : isWarn
                    ? "bg-amber-950/20 border-amber-900/40 text-amber-300"
                    : "bg-slate-900/80 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5 truncate">
                  <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">
                    [{log.timestamp}]
                  </span>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                      isCrit
                        ? "bg-rose-900 text-rose-200"
                        : isErr
                        ? "bg-rose-950 text-rose-400"
                        : isWarn
                        ? "bg-amber-950 text-amber-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {log.level}
                  </span>

                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-purple-300 text-[10px] shrink-0 font-sans">
                    {log.source}
                  </span>

                  <span className="truncate text-xs font-sans font-medium">
                    {log.message}
                  </span>
                </div>

                <button
                  onClick={() => handleRunAiDiagnosis(log)}
                  className="self-end sm:self-auto opacity-90 sm:opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-purple-900 hover:bg-purple-800 text-purple-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition shrink-0 font-sans"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  AI Анализ
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gemini AI Diagnosis Result Modal */}
      {(aiAnalyzing || aiResult) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Sparkles className="w-5 h-5 text-amber-400 animate-bounce" />
                Диагностика Логов Gemini AI
              </div>
              <button
                onClick={() => {
                  setAiResult(null);
                  setAiAnalyzing(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiAnalyzing ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">
                  Gemini AI анализирует логи сервера и генерирует скрипты исправления...
                </p>
              </div>
            ) : (
              aiResult && (
                <div className="space-y-4">
                  {/* Selected Log Target Banner */}
                  {selectedLogForAi && (
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-900/40 flex items-center justify-between text-xs font-mono">
                      <div className="truncate text-slate-300">
                        <span className="text-purple-400 font-bold mr-2">[{selectedLogForAi.source}]</span>
                        {selectedLogForAi.message}
                      </div>
                    </div>
                  )}

                  {/* Custom AI Prompt Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Задать дополнительный вопрос Gemini ИИ о проблеме..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customPrompt.trim()) {
                          handleRunAiDiagnosis(undefined, customPrompt);
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => handleRunAiDiagnosis(undefined, customPrompt)}
                      className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Запросить ИИ
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold uppercase text-purple-400 tracking-wider">
                      Сводка Проблемы
                    </div>
                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                      {aiResult.summary}
                    </p>
                  </div>

                  {/* Root cause */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-400">Анализ Первопричины</div>
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      {aiResult.rootCause}
                    </p>
                  </div>

                  {/* Suggested Commands */}
                  {aiResult.suggestedFixes && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4" />
                        Рекомендуемые Команды Bash (Выполнение по SSH)
                      </div>

                      <div className="space-y-1.5">
                        {aiResult.suggestedFixes.map((cmd: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono text-fuchsia-300"
                          >
                            <span className="truncate">{cmd}</span>
                            <button
                              onClick={() => handleExecuteFix(cmd)}
                              className="ml-2 px-2.5 py-1 bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-lg text-[10px] font-sans font-semibold shrink-0 transition"
                            >
                              Выполнить
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  <div className="text-[11px] text-slate-400">
                    {aiResult.explanation}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
