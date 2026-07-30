import React from "react";
import { TabType } from "../types";
import {
  LayoutDashboard,
  ShieldCheck,
  FolderTree,
  Cpu,
  Boxes,
  Shield,
  FileText,
  Terminal,
  Wrench,
} from "lucide-react";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  failedServicesCount?: number;
  criticalLogsCount?: number;
}

const NAV_ITEMS: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "dashboard", label: "Обзор", icon: LayoutDashboard },
  { id: "vpn", label: "ВПН", icon: ShieldCheck },
  { id: "files", label: "Файлы", icon: FolderTree },
  { id: "processes", label: "Процессы", icon: Cpu },
  { id: "services", label: "Службы", icon: Boxes },
  { id: "firewall", label: "Файрвол", icon: Shield },
  { id: "logs", label: "Логи", icon: FileText },
  { id: "terminal", label: "Терминал", icon: Terminal },
  { id: "tools", label: "Утилиты", icon: Wrench },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  failedServicesCount = 1,
  criticalLogsCount = 1,
}) => {
  return (
    <>
      {/* Mobile Bottom Navigation Bar (Touch & Scroll Optimized) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#090d16]/95 backdrop-blur-2xl border-t border-white/10 z-40 py-2 px-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.7)] overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center justify-between min-w-max mx-auto px-1 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasBadge =
              (item.id === "services" && failedServicesCount > 0) ||
              (item.id === "logs" && criticalLogsCount > 0);

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-3 min-w-[66px] min-h-[50px] rounded-2xl transition duration-150 shrink-0 active:scale-95 ${
                  isActive
                    ? "text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/25 shadow-lg shadow-emerald-950/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id={`tab-btn-${item.id}`}
              >
                {/* Active indicator top bar */}
                {isActive && (
                  <span className="absolute -top-2 w-7 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80" />
                )}

                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? "text-emerald-400 scale-110" : "text-slate-400"}`} />
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#090d16] animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-semibold tracking-tight mt-1 leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#090d16]/90 backdrop-blur-xl border-r border-white/10 shrink-0 p-4 space-y-6">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
            Меню Навигации
          </div>
          <div className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount =
                item.id === "services"
                  ? failedServicesCount
                  : item.id === "logs"
                  ? criticalLogsCount
                  : 0;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-semibold text-xs transition duration-150 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500/15 to-teal-500/10 text-emerald-300 font-bold border border-emerald-500/30 shadow-md shadow-emerald-950/30"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>

                  {badgeCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* System Health Quick Card in Desktop Sidebar */}
        <div className="mt-auto bg-slate-900/90 border border-white/10 rounded-3xl p-4 space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Состояние системы</span>
            <span className="text-emerald-400 font-extrabold font-mono">96%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-[96%] rounded-full shadow-sm" />
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            Все ключевые демоны активны. Критических ошибок накопителя не обнаружено.
          </p>
        </div>
      </aside>
    </>
  );
};

