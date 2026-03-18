"use client";

import { useState, useCallback } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

interface ConfirmOptions {
  title: string;
  description: string;
  variant?: "danger" | "warning";
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }, [options]);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      open={open}
      title={options.title}
      description={options.description}
      variant={options.variant}
      confirmLabel={options.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      loading={loading}
    />
  ) : null;

  return { confirm, dialog };
}
