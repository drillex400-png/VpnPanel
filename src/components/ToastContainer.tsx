import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useToastState } from "../contexts/ToastContext";

const STYLES: Record<string, { icon: React.ReactNode; classes: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-violet-400" />, classes: "border-violet-800 bg-violet-950/90" },
  error: { icon: <XCircle className="w-4 h-4 text-rose-400" />, classes: "border-rose-800 bg-rose-950/90" },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, classes: "border-amber-800 bg-amber-950/90" },
  info: { icon: <Info className="w-4 h-4 text-fuchsia-400" />, classes: "border-fuchsia-800 bg-fuchsia-950/90" },
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastState();

  // Note: previously this rendered nothing while `toasts.length === 0`, which is fine, but
  // the toasts themselves used Tailwind's `animate-in`/`slide-in-from-top-2`/`fade-in`
  // classes -- those come from the `tailwindcss-animate` plugin, which isn't installed here,
  // so they compiled to zero CSS and toasts just snapped in/out with no animation at all.
  // Replaced with real motion.div enter/exit via AnimatePresence.
  return createPortal(
    <div className="fixed top-3 right-3 left-3 sm:left-auto z-[200] flex flex-col gap-2 sm:w-80">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const style = STYLES[t.type] || STYLES.info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`border ${style.classes} rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{style.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white">{t.title}</div>
                  {t.description && <div className="text-slate-300 mt-0.5 break-words">{t.description}</div>}
                  {t.actionLabel && t.onAction && (
                    <button
                      onClick={() => {
                        t.onAction?.();
                        dismissToast(t.id);
                      }}
                      className="mt-2 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1"
                    >
                      {t.actionLabel}
                    </button>
                  )}
                </div>
                <button onClick={() => dismissToast(t.id)} className="text-slate-400 hover:text-white shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
};
