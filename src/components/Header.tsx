import React, { useState } from "react";
import { createPortal } from "react-dom";
import { SSHConfig } from "../types";
import { execCommand } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import {
  Server,
  ShieldCheck,
  RefreshCw,
  Zap,
  Power,
  Plus,
  ChevronDown,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sliders,
  X,
  Trash2,
  LogOut,
  Package,
} from "lucide-react";

interface HeaderProps {
  currentServer: SSHConfig;
  servers: SSHConfig[];
  onSelectServer: (server: SSHConfig) => void;
  onOpenConnectModal: () => void;
  onDeleteServer: (id: string) => void;
  isRefreshing: boolean;
  onManualRefresh: () => void;
  latencyMs?: number;
  currentUser?: { email: string; role: string } | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentServer,
  servers,
  onSelectServer,
  onOpenConnectModal,
  onDeleteServer,
  isRefreshing,
  onManualRefresh,
  latencyMs = 14,
  currentUser,
  onLogout,
}) => {
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const toast = useToast();

  const runQuickAction = async (label: string, command: string) => {
    setRunningAction(label);
    setShowQuickActionModal(false);
    try {
      const result = await execCommand(currentServer, command);
      if (result.code === 0) {
        toast.success(label, result.stdout?.trim().slice(0, 300) || "Команда выполнена успешно");
      } else {
        toast.error(`${label} — ошибка`, (result.stderr || "Команда завершилась с ошибкой").slice(0, 300));
      }
    } catch (e: any) {
      toast.error(`${label} — ошибка`, e?.message || "Не удалось выполнить команду");
    } finally {
      setRunningAction(null);
    }
  };

  // Docker install needs real verification (systemctl is-active + parsed version), not just
  // an exit code -- the install script's last exec-chained command can succeed even if the
  // daemon didn't actually come up, so a plain runQuickAction here would be misleading.
  const handleInstallDocker = async () => {
    const label = "Установить Docker";
    setRunningAction(label);
    setShowQuickActionModal(false);
    try {
      const command = `sudo bash -c 'curl -fsSL https://get.docker.com | sh && systemctl enable --now docker'; echo "===VERIFY==="; systemctl is-active docker 2>/dev/null; docker --version 2>/dev/null || echo NOT_FOUND`;
      const result = await execCommand(currentServer, command);
      const verifySection = (result.stdout || "").split("===VERIFY===")[1] || "";
      const isActive = verifySection.trim().split("\n")[0]?.trim() === "active";
      const versionMatch = verifySection.match(/version\s+([\d.]+)/i);

      if (isActive && versionMatch) {
        toast.success(label, `Docker ${versionMatch[1]} установлен, служба активна`);
      } else {
        toast.error(
          `${label} — не подтверждена`,
          (result.stderr || verifySection || "Не удалось подтвердить статус службы после установки").slice(0, 300)
        );
      }
    } catch (e: any) {
      toast.error(`${label} — ошибка`, e?.message || "Не удалось выполнить установку");
    } finally {
      setRunningAction(null);
    }
  };
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);

  return (
    <header className="bg-[#0b0f17]/90 backdrop-blur-xl border-b border-white/10 text-slate-200 sticky top-0 z-30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand & App Title -- hidden on mobile: on narrow phone widths the title text
            truncates away to nothing while the icon (shrink-0) stays fixed-size, so it ends
            up crammed directly against the server-switcher pill with no breathing room.
            Full-width mobile screens need that space for the functional controls instead;
            the branding only shows from sm: up where there's room for it to read properly. */}
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 via-slate-800 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-violet-950/30 text-violet-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white leading-tight truncate">
                Linux Cockpit
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30 shadow-inner">
                PRO SSH v2.4
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-semibold truncate mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-400 shadow-sm shadow-violet-400 animate-pulse shrink-0"></span>
              <span className="truncate">Центр управления серверами</span>
            </p>
          </div>
        </div>

        {/* Server Switcher Pill & Controls -- ml-auto keeps this pinned to the right edge
            even on mobile where the brand block above is hidden (display:none), leaving it
            as the row's only flex child. Plain `justify-between` on the parent only pushes
            a *second* item to the end; with a single child it collapses back to flex-start,
            which would otherwise yank these controls over to the left edge on phones. */}
        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          {/* Active Server Selector */}
          <div className="relative">
            <button
              onClick={() => setShowServerDropdown(!showServerDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 transition text-xs font-semibold text-slate-200 shadow-sm active:scale-95"
              id="server-selector-btn"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                  currentServer.isDemo ? "bg-violet-400 shadow-violet-500/50" : "bg-fuchsia-400 shadow-fuchsia-500/50"
                }`}
              />
              <span className="truncate max-w-[95px] xs:max-w-[130px] sm:max-w-[190px]">
                {currentServer.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {showServerDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
                  onClick={() => setShowServerDropdown(false)}
                />
                <div className="fixed top-16 left-3 right-3 max-w-sm mx-auto z-50 sm:absolute sm:top-full sm:mt-2 sm:left-auto sm:right-0 sm:w-80 sm:max-w-none bg-[#0d121d] border border-white/10 rounded-3xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-2xl">
                  <div className="px-3.5 py-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase border-b border-white/10 flex items-center justify-between">
                    <span>SSH Профили</span>
                    <span className="text-slate-400">{servers.length} подключено</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 scrollbar-thin">
                    {servers.map((srv) => (
                      <div
                        key={srv.id}
                        className={`group flex items-center justify-between px-3.5 py-2.5 text-xs transition cursor-pointer ${
                          srv.id === currentServer.id
                            ? "bg-violet-500/10 text-violet-300 font-semibold border-l-2 border-violet-400"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                        onClick={() => {
                          onSelectServer(srv);
                          setShowServerDropdown(false);
                        }}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <Server
                            className={`w-4 h-4 shrink-0 ${
                              srv.id === currentServer.id
                                ? "text-violet-400"
                                : "text-slate-500"
                            }`}
                          />
                          <div className="truncate">
                            <div className="truncate font-semibold text-white">{srv.name}</div>
                            <div className="text-[10px] text-slate-400 truncate font-mono">
                              {srv.username}@{srv.host}:{srv.port}
                            </div>
                          </div>
                        </div>

                        {srv.isDemo ? (
                          <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                            Демо
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteServer(srv.id);
                            }}
                            className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition"
                            title="Удалить SSH профиль"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        setShowServerDropdown(false);
                        onOpenConnectModal();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs transition shadow-lg shadow-violet-950/50"
                    >
                      <Plus className="w-4 h-4" />
                      Подключить SSH Сервер
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition shadow-sm active:scale-95"
            title="Обновить метрики сервера"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-violet-400" : ""}`}
            />
          </button>

          {/* Quick Actions Button */}
          <button
            onClick={() => setShowQuickActionModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs transition shadow-md shadow-violet-950/40 active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span className="hidden sm:inline">Быстрые действия</span>
            <span className="sm:hidden text-[11px]">Действия</span>
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-2xl bg-slate-900/90 hover:bg-rose-950 border border-white/10 text-slate-300 hover:text-rose-400 transition shadow-sm active:scale-95"
              title={currentUser ? `Выйти (${currentUser.email})` : "Выйти"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logout confirmation */}
      {showLogoutConfirm &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xs p-5 space-y-4 shadow-2xl">
              <div className="text-sm text-white font-bold">Выйти из аккаунта?</div>
              {currentUser && <div className="text-xs text-slate-400">{currentUser.email}</div>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Sub-bar Connection Status indicator */}
      <div className="bg-[#07090f]/90 px-3.5 sm:px-6 py-1.5 text-[11px] border-t border-white/[0.06] flex items-center justify-between text-slate-400 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2.5 sm:gap-3 truncate">
          <span className="flex items-center gap-1.5 text-violet-400 font-semibold shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse text-violet-400" />
            SSH Active
          </span>
          <span className="text-slate-700">|</span>
          <span className="truncate">
            Хост: <strong className="text-slate-200 font-mono">{currentServer.host}</strong> ({currentServer.username})
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="hidden sm:inline text-slate-400">
            Задержка: <strong className="text-violet-400 font-mono">{latencyMs} мс</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-300 font-mono text-[10px] border border-white/10 font-semibold">
            Linux 6.5 x86_64
          </span>
        </div>
      </div>

      {/* Quick Power Actions Modal */}
      {showQuickActionModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-[#0e131f] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto my-auto scrollbar-thin">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
                  <span>Быстрые действия с сервером</span>
                </div>
                <button
                  onClick={() => setShowQuickActionModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Быстрое выполнение стандартных системных команд на{" "}
                <strong className="text-white font-mono">{currentServer.name}</strong> ({currentServer.host}).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    runQuickAction("Перезапустить Nginx", "sudo systemctl restart nginx");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-fuchsia-400 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    Перезапустить Nginx
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Сброс конфигураций и веток подключения веб-сервера
                  </div>
                </button>

                <button
                  onClick={() => {
                    runQuickAction("Освободить Кэш ОЗУ", "sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-violet-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 shrink-0" />
                    Освободить Кэш ОЗУ
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Очистка буферов swap и неиспользуемой системной RAM
                  </div>
                </button>

                <button
                  onClick={() => {
                    runQuickAction("Сбросить Демон Docker", "sudo systemctl restart docker");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 shrink-0" />
                    Сбросить Демон Docker
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Перезапуск фонового контейнерного сокета systemd
                  </div>
                </button>

                <button
                  onClick={handleInstallDocker}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 shrink-0" />
                    Установить Docker
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Официальный скрипт get.docker.com, с проверкой запуска службы
                  </div>
                </button>

                <button
                  onClick={() => {
                    runQuickAction("Обновить Файрвол UFW", "sudo ufw reload");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Обновить Файрвол UFW
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Применение новых правил портов и политик безопасности
                  </div>
                </button>

                <button
                  onClick={() => {
                    runQuickAction("Ротация Логов Journal", "sudo journalctl --vacuum-time=3d");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 shrink-0" />
                    Ротация Логов Journal
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Удаление устаревших журналов старше 3 дней
                  </div>
                </button>

                <button
                  onClick={() => {
                    runQuickAction("Проверка Сбоев Демонов", "sudo systemctl status");
                  }}
                  className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 rounded-2xl text-left transition space-y-1 group active:scale-95 shadow-sm"
                >
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Проверка Сбоев Демонов
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Быстро составить список упавших служб systemd
                  </div>
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowQuickActionModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold transition border border-white/10"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

