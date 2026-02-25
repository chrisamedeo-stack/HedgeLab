"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const borderColors: Record<ToastType, string> = {
  success: "border-profit",
  error: "border-destructive",
  info: "border-action",
};

const iconColors: Record<ToastType, string> = {
  success: "text-profit",
  error: "text-destructive",
  info: "text-action",
};

const labels: Record<ToastType, string> = {
  success: "Success",
  error: "Error",
  info: "Info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-slide pointer-events-auto flex items-start gap-3 rounded-lg bg-input-bg border-l-4 px-4 py-3 shadow-xl min-w-[280px] max-w-sm ${borderColors[t.type]}`}
          >
            <span className={`text-xs font-semibold uppercase tracking-wider mt-0.5 ${iconColors[t.type]}`}>
              {labels[t.type]}
            </span>
            <p className="text-sm text-secondary flex-1">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
