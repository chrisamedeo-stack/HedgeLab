"use client";

import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { btnPrimary, btnCancel, cn } from "./shared";

export function TableSkeleton() {
  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 border-b border-b-default last:border-0">
          <div className="h-4 bg-hover rounded w-20" /><div className="h-4 bg-hover rounded w-40" /><div className="h-4 bg-hover rounded w-24" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, desc, onAction, actionLabel }: { title: string; desc: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-12 text-center">
      <p className="text-sm font-medium text-secondary">{title}</p>
      <p className="text-xs text-faint mt-1">{desc}</p>
      {onAction && actionLabel && (
        <button onClick={onAction} className={cn(btnPrimary, "mt-4")}><Plus className="h-4 w-4" /> {actionLabel}</button>
      )}
    </div>
  );
}

export function ConfirmDialog({ title, desc, onConfirm, onCancel }: { title: string; desc: string; onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-b-default rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-secondary">{title}</h3>
        <p className="text-sm text-muted">{desc}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={btnCancel}>Cancel</button>
          <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white hover:bg-loss/80 transition-colors">Confirm</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
