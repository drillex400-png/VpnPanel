import React, { useState, useRef, useEffect } from "react";
import { SSHConfig } from "../types";
import { execCommand } from "../services/api";
import {
  Terminal as TerminalIcon,
  Send,
  CornerDownLeft,
  Trash2,
  Copy,
  Sparkles,
  Play,
} from "lucide-react";

interface TerminalViewProps {
  server: SSHConfig;
}

interface CommandHistoryItem {
  command: string;
  output: string;
  error?: boolean;
  timestamp: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ server }) => {
  const [inputCommand, setInputCommand] = useState("");
  const [history, setHistory] = useState<CommandHistoryItem[]>([
    {
      command: "welcome",
      output: `Добро пожаловать в SSH Терминал Linux Mobile v2.4\nПодключено к ${server.username}@${server.host}:${server.port}\nОС: Linux 6.5.0-28-generic x86_64\nВведите bash команду ниже или используйте быстрые чипы.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || inputCommand).trim();
    if (!cmd) return;

    setIsExecuting(true);
    setInputCommand("");

    const res = await execCommand(server, cmd);

    setHistory((prev) => [
      ...prev,
      {
        command: cmd,
        output: res.stdout || res.stderr || "(Команда выполнена с пустым выводом)",
        error: res.code !== 0,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    setIsExecuting(false);
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRunCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex + 1;
        if (nextIdx < history.length) {
          setHistoryIndex(nextIdx);
          setInputCommand(history[history.length - 1 - nextIdx].command);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCommand(history[history.length - 1 - nextIdx].command);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand("");
      }
    }
  };

  const quickChips = [
    { label: "htop", cmd: "top -b -n 1 | head -n 15" },
    { label: "df -h", cmd: "df -h" },
    { label: "docker ps", cmd: "docker ps" },
    { label: "free -m", cmd: "free -m" },
    { label: "netstat", cmd: "netstat -tulnp" },
    { label: "uname -a", cmd: "uname -a" },
    { label: "nginx status", cmd: "systemctl status nginx" },
  ];

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-fuchsia-400">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Интерактивная SSH Консоль
            </h2>
            <p className="text-xs text-slate-400">
              {server.username}@{server.host}:{server.port}
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setHistory([
              {
                command: "clear",
                output: "Экран терминала очищен.",
                timestamp: new Date().toLocaleTimeString(),
              },
            ])
          }
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1 transition"
          title="Очистить Консоль"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Очистить</span>
        </button>
      </div>

      {/* Quick Mobile Command Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold text-[11px] shrink-0">
          Быстрые команды:
        </span>
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleRunCommand(chip.cmd)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-fuchsia-300 font-mono rounded-xl border border-slate-700/80 shrink-0 text-xs transition"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Console Display Screen */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-4 font-mono text-xs text-slate-200 space-y-4 min-h-[420px] max-h-[60vh] overflow-y-auto">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center gap-2 text-fuchsia-400 font-semibold">
              <span className="text-violet-400">{server.username}@{server.host}:~$</span>
              <span>{item.command}</span>
              <span className="text-[10px] text-slate-600 font-normal ml-auto">
                {item.timestamp}
              </span>
            </div>
            <pre
              className={`whitespace-pre-wrap p-2 rounded-lg font-mono text-xs leading-relaxed ${
                item.error
                  ? "bg-rose-950/40 text-rose-300 border border-rose-900/50"
                  : "bg-slate-900/60 text-slate-300"
              }`}
            >
              {item.output}
            </pre>
          </div>
        ))}
        {isExecuting && (
          <div className="text-fuchsia-400 font-semibold animate-pulse">
            Выполнение команды по SSH...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Touch-Friendly Mobile Input Controls & Keybar */}
      <div className="space-y-2">
        {/* Virtual Mobile Terminal Keybar (Ctrl+C, Tab, Up, Down) */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => handleRunCommand("\x03")}
            className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold rounded-xl border border-rose-800/80"
          >
            Ctrl + C
          </button>
          <button
            onClick={() => handleRunCommand("\x1a")}
            className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 font-bold rounded-xl border border-amber-800/80"
          >
            Ctrl + Z
          </button>
          <button
            onClick={() => setInputCommand((prev) => prev + "  ")}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700"
          >
            Tab
          </button>
          <button
            onClick={() => {
              if (history.length > 0) {
                const nextIdx = historyIndex + 1;
                if (nextIdx < history.length) {
                  setHistoryIndex(nextIdx);
                  setInputCommand(history[history.length - 1 - nextIdx].command);
                }
              }
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-fuchsia-300 font-bold rounded-xl border border-slate-700"
          >
            ↑ Пред.
          </button>
          <button
            onClick={() => {
              if (historyIndex > 0) {
                const nextIdx = historyIndex - 1;
                setHistoryIndex(nextIdx);
                setInputCommand(history[history.length - 1 - nextIdx].command);
              } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInputCommand("");
              }
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-fuchsia-300 font-bold rounded-xl border border-slate-700"
          >
            ↓ След.
          </button>
        </div>

        {/* Input Field */}
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            placeholder="Введите bash команду (например: sudo systemctl status nginx)..."
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 shadow-inner"
          />
          <button
            onClick={() => handleRunCommand()}
            disabled={isExecuting || !inputCommand.trim()}
            className="px-4 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-800 text-white font-semibold text-xs rounded-2xl shadow-md transition flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Выполнить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
