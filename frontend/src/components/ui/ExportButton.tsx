"use client";

import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function ExportButton({ onClick, disabled, label = "Export CSV" }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
