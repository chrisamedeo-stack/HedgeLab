"use client";

import { useState } from "react";
import type { BudgetLineItem } from "@/types/budget";
import { ComponentTokenBar } from "./ComponentTokenBar";

interface LineItemTableProps {
  items: BudgetLineItem[];
  onEdit?: (item: BudgetLineItem) => void;
  onDelete?: (itemId: string) => void;
  locked?: boolean;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(m: string): string {
  // "2025-01" → "Jan 25"
  const [y, mo] = m.split("-");
  const idx = parseInt(mo, 10) - 1;
  return `${MONTH_SHORT[idx] ?? mo} ${y.slice(2)}`;
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
  if (pct >= 100) return "text-profit";
  if (pct >= 50) return "text-action";
  return "text-muted";
}

export function LineItemTable({ items, onEdit, onDelete, locked }: LineItemTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totals = items.reduce(
    (acc, li) => ({
      budgeted: acc.budgeted + Number(li.budgeted_volume),
      committed: acc.committed + Number(li.committed_volume),
      hedged: acc.hedged + Number(li.hedged_volume),
      open: acc.open + Number(li.open_volume),
      budgetCost: acc.budgetCost + Number(li.budget_cost),
      notional: acc.notional + Number(li.total_notional ?? 0),
    }),
    { budgeted: 0, committed: 0, hedged: 0, open: 0, budgetCost: 0, notional: 0 }
  );
  const totalCoveragePct = totals.budgeted > 0
    ? ((totals.committed + totals.hedged) / totals.budgeted) * 100
    : 0;

  // Weighted average all-in price
  const weightedAllIn = items.reduce((sum, li) => {
    const vol = Number(li.budgeted_volume);
    const price = li.target_all_in_price != null ? Number(li.target_all_in_price) : 0;
    return sum + vol * price;
  }, 0);
  const avgAllIn = totals.budgeted > 0 ? weightedAllIn / totals.budgeted : 0;

  const hasActions = !locked && (onEdit || onDelete);
  const colCount = 11 + (hasActions ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tbl-border bg-tbl-header">
            <th className="px-1 py-2 w-8" /> {/* expand toggle */}
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Futures Ref</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Vol</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Price</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">All-in</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Notional</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Committed</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Hedged</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Open</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Coverage</th>
            {hasActions && <th className="px-3 py-2 w-20" />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-8 text-center text-faint">
                No line items. Add months using the form or fiscal year grid.
              </td>
            </tr>
          ) : (
            items.map((li) => {
              const isExpanded = expandedIds.has(li.id);
              const hasComponents = li.components && li.components.length > 0;
              const overHedged = li.over_hedged;

              return (
                <>
                  <tr key={li.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                    <td className="px-1 py-2 text-center">
                      {hasComponents ? (
                        <button
                          onClick={() => toggleExpand(li.id)}
                          className="text-muted hover:text-secondary transition-colors text-xs"
                        >
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </button>
                      ) : (
                        <span className="text-xs text-ph">&middot;</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-secondary">{fmtMonth(li.budget_month)}</td>
                    <td className="px-3 py-2">
                      {li.futures_month ? (
                        <span className="inline-flex items-center bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold">
                          {li.futures_month}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(li.budgeted_volume)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(li.budget_price)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-action font-semibold">
                      {li.target_all_in_price ? fmt(li.target_all_in_price) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-profit">{fmt(li.total_notional)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(li.committed_volume)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(li.hedged_volume)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warning">{fmt(li.open_volume)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${coverageColor(Number(li.coverage_pct))}`}>
                      <span className="flex items-center justify-end gap-1.5">
                        {fmtPct(li.coverage_pct)}
                        {overHedged && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-warning-10 ring-1 ring-warning-30 text-warning text-xs font-medium">
                            Over
                          </span>
                        )}
                      </span>
                    </td>
                    {hasActions && (
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
                  {/* Expanded row: component breakdown */}
                  {isExpanded && hasComponents && (
                    <tr key={`${li.id}-expand`} className="border-b border-tbl-border">
                      <td colSpan={colCount} className="px-6 py-3 bg-main/40 border-t border-b-default/50">
                        <ComponentTokenBar components={li.components!} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t border-b-default bg-surface">
              <td />
              <td className="px-3 py-2 text-xs font-medium text-muted">Total</td>
              <td />
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.budgeted)}</td>
              <td />
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">
                {avgAllIn > 0 ? fmt(avgAllIn) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.notional)}</td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.committed)}</td>
              <td className="px-3 py-2 text-right font-semibold text-secondary tabular-nums">{fmt(totals.hedged)}</td>
              <td className="px-3 py-2 text-right font-semibold text-warning tabular-nums">{fmt(totals.open)}</td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${coverageColor(totalCoveragePct)}`}>
                {fmtPct(totalCoveragePct)}
              </td>
              {hasActions && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
