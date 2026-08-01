import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FirewallRule, SSHConfig } from "../types";
import { execCommand } from "../services/api";
import { shQuote } from "../utils/shellQuote";
import { useToast } from "../contexts/ToastContext";
import { SkeletonLines } from "./Skeleton";
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
  Loader2,
} from "lucide-react";

interface FirewallViewProps {
  server: SSHConfig;
}

// ufw accepts a single port (1-65535) or a port range "start:end". Anything else
// is rejected client-side before it ever reaches a shell command.
const isValidUfwPort = (value: string): boolean =>
  /^\d{1,5}(:\d{1,5})?$/.test(value.trim()) &&
  value
    .trim()
    .split(":")
    .every((p) => Number(p) >= 1 && Number(p) <= 65535);

// Accepts "Anywhere"/empty (no source restriction), a bare IPv4, or an IPv4 CIDR block.
// Good enough gate for what ufw itself understands as a `from <addr>` clause -- ufw will
// still reject a semantically-invalid-but-regex-valid address on its own, we're only
// trying to keep obviously wrong input (hostnames, junk text) out of the shell command.
const isValidUfwSource = (value: string): boolean => {
  const v = value.trim();
  if (!v || v.toLowerCase() === "anywhere") return true;
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(v);
};

export const FirewallView: React.FC<FirewallViewProps> = ({ server }) => {
  const toast = useToast();
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [ufwActive, setUfwActive] = useState(false);
  const [ufwInstalled, setUfwInstalled] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Listening ports list -- starts empty; only ever populated from a real `ss -tulpn` parse
  // (see fetchFirewallData below), never from canned/fake data.
  const [listeningPorts, setListeningPorts] = useState<
    Array<{ port: number | string; proto: string; process: string; pid: number | string }>
  >([]);

  // New Rule Form
  const [newPort, setNewPort] = useState("");
  const [newProto, setNewProto] = useState<"tcp" | "udp" | "any">("tcp");
  const [newAction, setNewAction] = useState<"ALLOW" | "DENY">("ALLOW");
  const [newFrom, setNewFrom] = useState("Anywhere");
  const [newComment, setNewComment] = useState("");

  const fetchFirewallData = async () => {
    setIsLoading(true);
    try {
      // 0. Is ufw even installed on this box? Without this, a missing binary just silently
      // fails to parse below and we'd wrongly report "0 rules, inactive".
      const whichRes = await execCommand(server, "command -v ufw >/dev/null 2>&1 && echo UFW_OK || echo UFW_MISSING");
      const installed = (whichRes?.stdout || "").includes("UFW_OK");
      setUfwInstalled(installed);
      if (!installed) {
        setFetchError(null);
        setRules([]);
        return;
      }

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
        // Real, authoritative state from the server -- always replace, even with an empty
        // list, so a rule that was actually removed (by us or anyone else) disappears too.
        setRules(parsedRules);
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
        setListeningPorts(parsedPorts);
      }
      setFetchError(null);
    } catch (e: any) {
      console.error("Failed to fetch firewall data:", e);
      setFetchError(e?.message || "Ошибка подключения к серверу");
      toast.error("Не удалось получить данные фаервола", e?.message || "Ошибка подключения к серверу");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchFirewallData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id, server.host]);

  // Detects which local port sshd is actually listening on (usually 22, but not always) --
  // used as a safety net before force-enabling ufw so we never lock ourselves out of the
  // very server we're managing.
  const detectSshPort = async (): Promise<string> => {
    try {
      const res = await execCommand(
        server,
        "ss -tlnp 2>/dev/null | grep -i sshd | grep -oE ':[0-9]+' | head -1 | tr -d ':'"
      );
      const port = (res?.stdout || "").trim();
      return /^\d{1,5}$/.test(port) ? port : "22";
    } catch {
      return "22";
    }
  };

  const handleToggleUfw = async () => {
    const nextState = !ufwActive;
    setIsToggling(true);
    try {
      if (nextState) {
        // Enabling ufw for the first time can lock out the very SSH session managing it if
        // there's no allow rule for the SSH port yet -- `ufw enable` itself only warns about
        // this interactively, and we run it non-interactively (--force, no TTY to answer the
        // prompt). So we proactively ensure an allow rule for the detected SSH port exists
        // FIRST, before ufw starts enforcing anything.
        const sshPort = await detectSshPort();
        await execCommand(server, `sudo ufw allow ${shQuote(`${sshPort}/tcp`)}`);
        // --force skips the interactive "Proceed with operation (y|n)?" prompt, which would
        // otherwise hang (or silently no-op) since exec has no stdin/TTY attached.
        await execCommand(server, "sudo ufw --force enable");
      } else {
        await execCommand(server, "sudo ufw disable");
      }

      // Verify against real server state rather than trusting the command's exit code --
      // re-read `ufw status` and confirm it actually flipped.
      const verifyRes = await execCommand(server, "sudo ufw status");
      const isActiveNow = (verifyRes?.stdout || "").toLowerCase().includes("status: active");

      if (isActiveNow !== nextState) {
        toast.error(
          "Не удалось изменить статус файрвола",
          `Ожидалось состояние "${nextState ? "активен" : "неактивен"}", но сервер сообщает обратное`
        );
      } else {
        toast.success(
          nextState ? "Файрвол включён" : "Файрвол отключён",
          nextState ? "Правило для SSH-порта добавлено автоматически, чтобы не потерять доступ" : undefined
        );
      }
      await fetchFirewallData();
    } catch (e: any) {
      toast.error("Ошибка при изменении статуса файрвола", e?.message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteRule = async (rule: FirewallRule) => {
    if (!confirm(`Удалить правило файрвола для порта ${rule.port}/${rule.protocol}?`)) return;
    setDeletingRuleId(rule.id);
    try {
      // rule.port/rule.action are parsed from `ufw status verbose` output, not raw
      // free-text, but we still single-quote them before rebuilding the shell
      // command -- defense in depth against an unexpected/crafted upstream value.
      const res = await execCommand(
        server,
        `sudo ufw --force delete ${shQuote(rule.action.toLowerCase())} ${shQuote(`${rule.port}/${rule.protocol}`)}`
      );
      if (res.code !== 0) {
        throw new Error(res.stderr || "ufw delete завершился с ошибкой");
      }
      toast.success("Правило удалено", `${rule.port}/${rule.protocol}`);
      // Re-sync from real server state instead of trusting our own optimistic patch.
      await fetchFirewallData();
    } catch (e: any) {
      toast.error("Не удалось удалить правило", e?.message);
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleAddRule = async () => {
    const trimmedPort = newPort.trim();
    if (!trimmedPort) return;
    if (!isValidUfwPort(trimmedPort)) {
      toast.error("Некорректный порт", "Введите порт 1-65535 или диапазон вида 6000:6007");
      return;
    }
    const trimmedFrom = newFrom.trim() || "Anywhere";
    if (!isValidUfwSource(trimmedFrom)) {
      toast.error("Некорректный источник", 'Введите "Anywhere", IP-адрес (1.2.3.4) или CIDR (1.2.3.0/24)');
      return;
    }

    setIsSubmittingRule(true);
    try {
      const isAnywhere = trimmedFrom.toLowerCase() === "anywhere";
      // Two shapes: unrestricted ("allow 8080/tcp") vs source-restricted
      // ("allow from 1.2.3.4 to any port 8080 proto tcp") -- ufw's "any" proto isn't valid
      // in the `proto` clause of the `from ... to any port ...` form, so it's simply omitted.
      const cmd = isAnywhere
        ? `sudo ufw ${shQuote(newAction.toLowerCase())} ${shQuote(`${trimmedPort}/${newProto}`)}`
        : `sudo ufw ${shQuote(newAction.toLowerCase())} from ${shQuote(trimmedFrom)} to any port ${shQuote(
            trimmedPort
          )}${newProto !== "any" ? ` proto ${shQuote(newProto)}` : ""}`;

      const res = await execCommand(server, cmd);
      if (res.code !== 0) {
        throw new Error(res.stderr || "ufw завершился с ошибкой");
      }

      toast.success("Правило добавлено", `${trimmedPort}/${newProto} — ${newAction}`);
      setShowAddModal(false);
      setNewPort("");
      setNewComment("");
      setNewFrom("Anywhere");
      // Re-sync from real server state (also picks up ufw's own numbering/formatting)
      // instead of trusting a locally-fabricated FirewallRule object.
      await fetchFirewallData();
    } catch (e: any) {
      toast.error("Не удалось добавить правило", e?.message);
    } finally {
      setIsSubmittingRule(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Banner: Firewall Status */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
              ufwActive
                ? "bg-violet-950/80 border-violet-800/80 text-violet-400"
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
                    ? "bg-violet-950 text-violet-400 border border-violet-800/60"
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
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700 rounded-xl font-semibold text-xs transition disabled:opacity-50"
            title="Обновить правила файрвола и порты"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Обновить</span>
          </button>
          <button
            onClick={handleToggleUfw}
            disabled={isToggling || !ufwInstalled}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
              ufwActive
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-950/40"
            }`}
          >
            {isToggling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {ufwActive ? "Отключить Файрвол" : "Включить UFW"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!ufwInstalled}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-950/40 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Добавить Правило
          </button>
        </div>
      </div>

      {!hasLoadedOnce && (
        <div className="glass-card rounded-3xl p-4 space-y-2">
          <SkeletonLines count={4} />
        </div>
      )}
      {hasLoadedOnce && !ufwInstalled && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 text-xs text-amber-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>UFW не установлен на этом сервере. Установите его (например, <code className="font-mono text-amber-300">apt install ufw</code>) через вкладку «Утилиты» или терминал.</span>
        </div>
      )}
      {hasLoadedOnce && fetchError && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Не удалось получить актуальные данные с сервера: {fetchError}</span>
        </div>
      )}

      {/* Rules Table */}
      {ufwInstalled && (
      <div className="glass-card rounded-3xl shadow-2xl overflow-hidden p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-400" />
          Активные Правила Безопасности UFW ({rules.length})
        </h3>

        {rules.length === 0 && hasLoadedOnce && !isLoading && (
          <p className="text-xs text-slate-500 py-2">Нет активных правил UFW.</p>
        )}

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
                  <td className="py-3 px-3 font-semibold text-fuchsia-300">
                    {rule.port} / {rule.protocol.toUpperCase()}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.action === "ALLOW"
                          ? "bg-violet-950 text-violet-400 border border-violet-800/60"
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
                      disabled={deletingRuleId === rule.id}
                      className="p-1.5 hover:bg-slate-800 text-rose-400 rounded transition disabled:opacity-50"
                      title="Удалить правило"
                    >
                      {deletingRuleId === rule.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Listening Ports Table */}
      <div className="glass-card rounded-3xl shadow-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-purple-400" />
          Открытые Прослушиваемые Порты (Netstat / Сокеты)
        </h3>

        {listeningPorts.length === 0 && hasLoadedOnce && !isLoading && (
          <p className="text-xs text-slate-500 py-2">Нет данных о прослушиваемых портах.</p>
        )}

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
                  <td className="py-2.5 px-3 font-bold text-fuchsia-400">:{lp.port}</td>
                  <td className="py-2.5 px-3 text-slate-400">{lp.proto}</td>
                  <td className="py-2.5 px-3 font-sans text-xs text-slate-200">{lp.process}</td>
                  <td className="py-2.5 px-3 text-right text-fuchsia-400 font-bold">{lp.pid}</td>
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
                  <Plus className="w-4 h-4 text-violet-400 shrink-0" />
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
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
                  <label className="text-xs text-slate-400">От Хоста / IP (необязательно)</label>
                  <input
                    type="text"
                    placeholder="Anywhere, 1.2.3.4 или 1.2.3.0/24"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ограничьте правило конкретным IP/подсетью, чтобы не открывать порт всему интернету.
                  </p>
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
                  disabled={isSubmittingRule}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddRule}
                  disabled={isSubmittingRule}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {isSubmittingRule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
