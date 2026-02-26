"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { btnCancel } from "@/lib/corn-format";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    },
    [onCancel, loading]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => { if (!loading) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-surface border border-b-default rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="text-sm text-muted mt-2">{description}</p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cn(btnCancel, "disabled:opacity-50")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
              isDanger
                ? "bg-destructive hover:bg-destructive-hover text-white"
                : "bg-warning hover:bg-warning-hover text-white"
            )}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
