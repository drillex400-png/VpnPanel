import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, RefreshCw, Terminal, LogOut, CornerDownLeft } from "lucide-react";
import { TabType } from "../types";
import { NAV_ITEMS } from "./Navigation";

interface CommandPaletteProps {
  onNavigate: (tab: TabType) => void;
  onRefresh: () => void;
  onLogout?: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
  run: () => void;
}

/**
 * Global Cmd+K / Ctrl+K quick-action launcher. This is the single feature that most reliably
 * signals "built by people who care" in tools like Linear/Vercel/Raycast -- and it fits
 * naturally here since the app already has a real SSH terminal tab, so "jump anywhere by
 * typing" isn't a bolted-on gimmick, it matches the tool's own command-line character.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ onNavigate, onRefresh, onLogout }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = useMemo(() => {
    const navItems: PaletteItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.id}`,
      label: n.label,
      hint: "Перейти",
      icon: n.icon,
      run: () => onNavigate(n.id),
    }));
    const actionItems: PaletteItem[] = [
      { id: "action-refresh", label: "Обновить метрики", hint: "Действие", icon: RefreshCw, run: onRefresh },
      { id: "action-terminal", label: "Открыть SSH консоль", hint: "Действие", icon: Terminal, run: () => onNavigate("terminal") },
    ];
    if (onLogout) {
      actionItems.push({ id: "action-logout", label: "Выйти", hint: "Действие", icon: LogOut, run: onLogout });
    }
    return [...navItems, ...actionItems];
  }, [onNavigate, onRefresh, onLogout]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  // Global shortcut listener: Cmd+K / Ctrl+K toggles, Escape closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("panelvpn:open-command-palette", openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("panelvpn:open-command-palette", openHandler);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the mount/animation frame so autofocus reliably lands.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        item.run();
        close();
      }
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[200] flex items-start justify-center pt-[12vh] px-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden ring-1 ring-violet-500/20"
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Куда перейти или что сделать?"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 shrink-0">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto scrollbar-thin py-1.5">
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-500">Ничего не найдено</p>
              )}
              {filtered.map((item, idx) => {
                const Icon = item.icon;
                const active = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      item.run();
                      close();
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                      active ? "bg-violet-500/15 text-white" : "text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-400" : "text-slate-500"}`} />
                      <span className="text-xs font-semibold truncate">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500 shrink-0">
                      {item.hint}
                      {active && <CornerDownLeft className="w-3 h-3 text-violet-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
