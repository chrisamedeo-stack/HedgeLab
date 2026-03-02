"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Edit2, Trash2 } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { BUSHELS_PER_MT, monthLabel } from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { fmtVol, fmtPrice, fmtDollars, lineNotional } from "./shared";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function BudgetRow({ line, onEdit, onDeleted }: {
  line: CornBudgetLineResponse; onEdit: (l: CornBudgetLineResponse) => void; onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/corn/budget/${line.id}`);
      toast("Budget line deleted", "success");
      onDeleted();
    } catch { toast("Delete failed", "error"); }
    finally { setDeleting(false); setShowConfirm(false); }
  }

  const buVal = line.budgetVolumeBu ?? (line.budgetVolumeMt * BUSHELS_PER_MT);
  const notional = lineNotional(line);

  return (
    <>
      <tr className="hover:bg-row-hover transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-faint hover:text-secondary transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-secondary">{monthLabel(line.budgetMonth)}</td>
        <td className="px-4 py-3 text-xs">{line.futuresMonth ? <span className="bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold">{line.futuresMonth}</span> : "\u2014"}</td>
        <td className="px-4 py-3 tabular-nums text-secondary text-right">{fmtVol(buVal)}</td>
        <td className="px-4 py-3 text-right">
          {line.targetAllInPerMt != null
            ? <span className="text-action font-semibold tabular-nums">${(line.targetAllInPerMt / BUSHELS_PER_MT).toFixed(4)}</span>
            : <span className="text-ph">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {notional != null
            ? <span className="text-profit tabular-nums text-xs">{fmtDollars(notional)}</span>
            : <span className="text-ph">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-faint text-xs">{line.notes ?? ""}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => onEdit(line)} className="text-ph hover:text-action transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => setShowConfirm(true)} className="text-ph hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="px-8 py-3 bg-main/40 border-t border-b-default/50">
            {line.components.length > 0 ? (
              <div className="space-y-1">
                {line.components.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 text-xs">
                    <span className="text-muted w-40">{c.componentName}</span>
                    <span className="text-faint w-16">{c.unit}</span>
                    <span className="tabular-nums text-secondary w-20 text-right">{fmtPrice(c.targetValue)}</span>
                    <span className="tabular-nums text-faint w-24 text-right">&asymp; ${c.valuePerMt != null ? (c.valuePerMt / BUSHELS_PER_MT).toFixed(4) : "\u2014"}/bu</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ph">No cost components</p>
            )}
          </td>
        </tr>
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Delete Budget Line"
        description={`Delete the ${monthLabel(line.budgetMonth)} budget line? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        loading={deleting}
      />
    </>
  );
}
