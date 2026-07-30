import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FirewallRule, SSHConfig } from "../types";
import { INITIAL_FIREWALL_RULES, execCommand } from "../services/api";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Globe,
  Lock,
  Radio,
  X,
  Check,
  RefreshCw,
} from "lucide-react";

interface FirewallViewProps {
  server: SSHConfig;
}

export const FirewallView: React.FC<FirewallViewProps> = ({ server }) => {
  const [rules, setRules] = useState<FirewallRule[]>(INITIAL_FIREWALL_RULES);
  const [ufwActive, setUfwActive] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Listening ports list
  const [listeningPorts, setListeningPorts] = useState<
    Array<{ port: number | string; proto: string; process: string; pid: number | string }>
  >([
    { port: 22, proto: "TCP", process: "sshd (OpenSSH)", pid: 891 },
    { port: 80, proto: "TCP", process: "nginx (HTTP)", pid: 1204 },
    { port: 443, proto: "TCP", process: "nginx (HTTPS)", pid: 1204 },
    { port: 3000, proto: "TCP", process: "node (API Server)", pid: 3210 },
    { port: 5432, proto: "TCP", process: "postgres (Database)", pid: 1540 },
    { port: 6379, proto: "TCP", process: "redis-server", pid: 1890 },
  ]);

  // New Rule Form
  const [newPort, setNewPort] = useState("");
  const [newProto, setNewProto] = useState<"tcp" | "udp" | "any">("tcp");
  const [newAction, setNewAction] = useState<"ALLOW" | "DENY">("ALLOW");
  const [newFrom, setNewFrom] = useState("Anywhere");
  const [newComment, setNewComment] = useState("");

  const fetchFirewallData = async () => {
    setIsLoading(true);
    try {
      // 1. UFW status & rules
      const ufwRes = await execCommand(server, "sudo ufw status verbose");
      if (ufwRes && ufwRes.stdout) {
        if (ufwRes.stdout.toLowerCase().includes("active") && !ufwRes.stdout.toLowerCase().includes("inactive")) {
          setUfwActive(true);
        } else if (ufwRes.stdout.toLowerCase().includes("inactive")) {
          setUfwActive(false);
        }

        const lines = ufwRes.stdout.split("\n").map((l) => l.trim());
        const parsedRules: FirewallRule[] = [];
        let ruleIdx = 1;
        for (const l of lines) {
          const rMatch = l.match(/^([0-9A-Za-z_-]+)(?:\/([a-z]+))?\s+(ALLOW|DENY|ALLOW IN|DENY IN)\s+(.*)$/i);
          if (rMatch) {
            const [, port, proto, act, from] = rMatch;
            parsedRules.push({
              id: `rule-${ruleIdx++}`,
              port,
              protocol: (proto ? proto.toLowerCase() : "any") as any,
              action: act.toUpperCase().includes("ALLOW") ? "ALLOW" : "DENY",
              from: from || "Anywhere",
              comment: "Правило UFW",
            });
          }
        }
        if (parsedRules.length > 0) setRules(parsedRules);
      }

      // 2. Open listening ports via ss -tulpn
      const ssRes = await execCommand(server, "ss -tulpn");
      if (ssRes && ssRes.stdout) {
        const ssLines = ssRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsedPorts: Array<{ port: number | string; proto: string; process: string; pid: number | string }> = [];
        for (const line of ssLines) {
          if (line.startsWith("Netid") || line.startsWith("State")) continue;
          const parts = line.split(/\s+/);
          if (parts.length >= 5) {
            const proto = parts[0].toUpperCase();
            const localAddr = parts[4];
            const processInfo = parts[6] || parts[5] || "";

            const portMatch = localAddr.match(/:(\d+)$/);
            if (portMatch) {
              const portNum = portMatch[1];
              let procName = "unknown";
              let pidNum: number | string = "-";
              const procMatch = processInfo.match(/"([^"]+)"(?:,pid=(\d+))?/);
              if (procMatch) {
                procName = procMatch[1];
                if (procMatch[2]) pidNum = parseInt(procMatch[2], 10);
              }
              parsedPorts.push({
                port: portNum,
                proto,
                process: procName,
                pid: pidNum,
              });
            }
          }
        }
        if (parsedPorts.length > 0) setListeningPorts(parsedPorts);
      }
    } catch (e) {
      console.error("Failed to fetch firewall data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewallData();
  }, [server.id, server.host]);

  const handleToggleUfw = async () => {
    const nextState = !ufwActive;
    await execCommand(server, `sudo ufw ${nextState ? "enable" : "disable"}`);
    setUfwActive(nextState);
  };

  const handleDeleteRule = async (rule: FirewallRule) => {
    if (confirm(`Remove firewall rule for port ${rule.port}/${rule.protocol}?`)) {
      await execCommand(server, `sudo ufw delete ${rule.action.toLowerCase()} ${rule.port}/${rule.protocol}`);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    }
  };

  const handleAddRule = async () => {
    if (!newPort.trim()) return;
    const cmd = `sudo ufw ${newAction.toLowerCase()} ${newPort.trim()}/${newProto}`;
    await execCommand(server, cmd);

    const newRule: FirewallRule = {
      id: "rule-" + Date.now(),
      port: newPort.trim(),
      protocol: newProto,
      action: newAction,
      from: newFrom.trim() || "Anywhere",
      comment: newComment.trim() || "User Rule",
    };

    setRules((prev) => [...prev, newRule]);
    setShowAddModal(false);
    setNewPort("");
    setNewComment("");
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Banner: Firewall Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
              ufwActive
                ? "bg-amber-950/80 border-amber-800/80 text-amber-400"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {ufwActive ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Файрвол UFW (Uncomplicated Firewall)
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  ufwActive
                    ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {ufwActive ? "АКТИВЕН" : "НЕАКТИВЕН"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Защита портов сервера от несанкционированного внешнего трафика
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchFirewallData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl font-semibold text-xs transition disabled:opacity-50"
            title="Обновить правила файрвола и порты"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Обновить</span>
          </button>
          <button
            onClick={handleToggleUfw}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              ufwActive
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                : "bg-amber-600 hover:bg-amber-500 text-white shadow-md"
            }`}
          >
            {ufwActive ? "Отключить Файрвол" : "Включить UFW"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Добавить Правило
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          Активные Правила Безопасности UFW ({rules.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/60">
                <th className="py-2.5 px-3">Порт / Протокол</th>
                <th className="py-2.5 px-3">Действие</th>
                <th className="py-2.5 px-3">От Хоста / IP</th>
                <th className="py-2.5 px-3">Описание</th>
                <th className="py-2.5 px-3 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-semibold text-cyan-300">
                    {rule.port} / {rule.protocol.toUpperCase()}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.action === "ALLOW"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : "bg-rose-950 text-rose-400 border border-rose-800/60"
                      }`}
                    >
                      {rule.action === "ALLOW" ? "РАЗРЕШИТЬ" : "БЛОКИРОВАТЬ"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-300">{rule.from}</td>
                  <td className="py-3 px-3 text-slate-400 font-sans text-xs">
                    {rule.comment || "—"}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      className="p-1.5 hover:bg-slate-800 text-rose-400 rounded transition"
                      title="Удалить правило"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Listening Ports Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-purple-400" />
          Открытые Прослушиваемые Порты (Netstat / Сокеты)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2 px-3">Порт</th>
                <th className="py-2 px-3">Протокол</th>
                <th className="py-2 px-3">Процесс</th>
                <th className="py-2 px-3 text-right">PID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {listeningPorts.map((lp, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-bold text-amber-400">:{lp.port}</td>
                  <td className="py-2.5 px-3 text-slate-400">{lp.proto}</td>
                  <td className="py-2.5 px-3 font-sans text-xs text-slate-200">{lp.process}</td>
                  <td className="py-2.5 px-3 text-right text-cyan-400 font-bold">{lp.pid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 sm:p-5 space-y-4 shadow-2xl my-auto max-h-[85vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Добавить Правило Файрвола UFW</span>
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Номер Порта (например: 8080, 22)</label>
                  <input
                    type="text"
                    placeholder="8080"
                    value={newPort}
                    onChange={(e) => setNewPort(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Протокол</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="any">ЛЮБОЙ (ANY)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Действие</label>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="ALLOW">РАЗРЕШИТЬ (ALLOW)</option>
                    <option value="DENY">БЛОКИРОВАТЬ (DENY)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Комментарий / Заметка</label>
                  <input
                    type="text"
                    placeholder="Порт API Приложения"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Добавить Правило
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
