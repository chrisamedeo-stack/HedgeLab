"use client";

import type { BudgetLineItem } from "@/types/budget";

interface LineItemTableProps {
  items: BudgetLineItem[];
  onEdit?: (item: BudgetLineItem) => void;
  onDelete?: (itemId: string) => void;
  locked?: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}

function coverageColor(pct: number): string {
  if (pct >= 80) return "text-profit";
  if (pct >= 50) return "text-warning";
  return "text-loss";
}

export function LineItemTable({ items, onEdit, onDelete, locked }: LineItemTableProps) {
  const totals = items.reduce(
    (acc, li) => ({
      budgeted: acc.budgeted + Number(li.budgeted_volume),
      committed: acc.committed + Number(li.committed_volume),
      hedged: acc.hedged + Number(li.hedged_volume),
      open: acc.open + Number(li.open_volume),
      budgetCost: acc.budgetCost + Number(li.budget_cost),
    }),
    { budgeted: 0, committed: 0, hedged: 0, open: 0, budgetCost: 0 }
  );
  const totalCoveragePct = totals.budgeted > 0
    ? ((totals.committed + totals.hedged) / totals.budgeted) * 100
    : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tbl-border bg-tbl-header">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Vol</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Price</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Cost</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Committed</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Hedged</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Open</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Coverage</th>
            {(!locked && (onEdit || onDelete)) && (
              <th className="px-3 py-2 w-20" />
            )}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-faint">
                No line items. Add months using the form or fiscal year grid.
              </td>
            </tr>
          ) : (
            items.map((li) => (
              <tr key={li.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                <td className="px-3 py-2 text-secondary">{li.budget_month}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(li.budgeted_volume)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(li.budget_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(li.budget_cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(li.committed_volume)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(li.hedged_volume)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-warning">{fmt(li.open_volume)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${coverageColor(Number(li.coverage_pct))}`}>
                  {fmtPct(li.coverage_pct)}
                </td>
                {(!locked && (onEdit || onDelete)) && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(li)}
                          className="text-xs text-muted hover:text-secondary transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(li.id)}
                          className="text-xs text-muted hover:text-loss transition-colors"
                        >
                          Del
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t border-b-default bg-surface">
              <td className="px-3 py-2 text-xs font-medium text-muted">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.budgeted)}</td>
              <td />
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.budgetCost)}</td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.committed)}</td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.hedged)}</td>
              <td className="px-3 py-2 text-right font-semibold text-warning tabular-nums">{fmt(totals.open)}</td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${coverageColor(totalCoveragePct)}`}>
                {fmtPct(totalCoveragePct)}
              </td>
              {(!locked && (onEdit || onDelete)) && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
