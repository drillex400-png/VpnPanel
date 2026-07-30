import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastState } from "../contexts/ToastContext";

const STYLES: Record<string, { icon: React.ReactNode; classes: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, classes: "border-emerald-800 bg-emerald-950/90" },
  error: { icon: <XCircle className="w-4 h-4 text-rose-400" />, classes: "border-rose-800 bg-rose-950/90" },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, classes: "border-amber-800 bg-amber-950/90" },
  info: { icon: <Info className="w-4 h-4 text-cyan-400" />, classes: "border-cyan-800 bg-cyan-950/90" },
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastState();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-3 right-3 left-3 sm:left-auto z-[200] flex flex-col gap-2 sm:w-80">
      {toasts.map((t) => {
        const style = STYLES[t.type] || STYLES.info;
        return (
          <div
            key={t.id}
            className={`border ${style.classes} rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs animate-in slide-in-from-top-2 fade-in duration-200`}
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
          </div>
        );
      })}
    </div>,
    document.body
  );
};
