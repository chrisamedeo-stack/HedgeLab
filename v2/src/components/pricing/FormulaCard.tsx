"use client";

import { Edit2, Copy, Play, XCircle } from "lucide-react";
import type { FormulaRow } from "@/types/pricing";

const TYPE_COLORS: Record<string, string> = {
  all_in: "bg-action-20 text-action",
  delivered: "bg-profit-20 text-profit",
  basis: "bg-warning-10 text-warning",
  fixed: "bg-input-bg text-muted",
};

interface Props {
  formula: FormulaRow;
  onEdit: () => void;
  onDuplicate: () => void;
  onTest: () => void;
  onDeactivate: () => void;
}

export function FormulaCard({ formula, onEdit, onDuplicate, onTest, onDeactivate }: Props) {
  const typeColor = TYPE_COLORS[formula.formula_type] ?? "bg-input-bg text-muted";

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 hover:border-b-input transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-primary truncate">{formula.name}</h4>
          {formula.description && (
            <p className="text-xs text-faint mt-0.5 line-clamp-2">{formula.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-ph hover:text-action transition-colors" title="Edit">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDuplicate} className="p-1.5 text-ph hover:text-action transition-colors" title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={onTest} className="p-1.5 text-ph hover:text-profit transition-colors" title="Test">
            <Play className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDeactivate} className="p-1.5 text-ph hover:text-destructive transition-colors" title="Deactivate">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
          {formula.formula_type.replace(/_/g, " ")}
        </span>
        {formula.commodity_id ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-action-20 text-action">
            {formula.commodity_id}
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-input-bg text-faint">
            All commodities
          </span>
        )}
        <span className="text-xs text-faint ml-auto">
          {formula.components.length} components
        </span>
        {formula.output_unit && (
          <span className="text-xs text-muted font-mono">{formula.output_unit}</span>
        )}
      </div>

      {formula.is_system && (
        <div className="mt-2 text-xs text-faint italic">System formula</div>
      )}
    </div>
  );
}
