"use client";

import { Plus } from "lucide-react";
import { btnPrimary, cn } from "./shared";
import { ConfirmDialog as BaseConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  return (
    <BaseConfirmDialog
      open
      title={title}
      description={desc}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
