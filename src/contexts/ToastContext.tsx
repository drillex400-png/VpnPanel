import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = "toast-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => dismissToast(id), 6000);
      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  const { showToast } = ctx;
  return {
    success: (title: string, description?: string) => showToast({ type: "success", title, description }),
    error: (title: string, description?: string) => showToast({ type: "error", title, description }),
    warning: (title: string, description?: string, actionLabel?: string, onAction?: () => void) =>
      showToast({ type: "warning", title, description, actionLabel, onAction }),
    info: (title: string, description?: string) => showToast({ type: "info", title, description }),
  };
}

export function useToastState() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastState must be used within ToastProvider");
  return ctx;
}
