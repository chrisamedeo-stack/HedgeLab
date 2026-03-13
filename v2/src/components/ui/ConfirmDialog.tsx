"use client";

import { Modal } from "./Modal";
import { btnCancel, btnDanger, btnPrimary } from "@/lib/ui-classes";

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
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={btnCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={variant === "danger" ? btnDanger : btnPrimary}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
