"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { HedgeBookEntry } from "@/types/positions";

interface BudgetLineItem {
  id: string;
  period_id: string;
  budget_month: string;
  budgeted_volume: number;
  hedged_volume: number;
  committed_volume: number;
  hedged_avg_price: number | null;
  budget_price: number | null;
}

interface BudgetMonthGroup {
  month: string;
  budgetedVolume: number;
  hedgedVolume: number;
  committedVolume: number;
  coveragePct: number;
  avgHedgedPrice: number | null;
  allocations: HedgeBookEntry[];
}

interface Props {
  entries: HedgeBookEntry[];
  orgId: string;
  siteId?: string;
  commodityId?: string;
  onCancelAllocation?: (allocationId: string) => Promise<void>;
}

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function BudgetMonthTable({ entries, orgId, siteId, commodityId, onCancelAllocation }: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetLineItem[]>([]);

  // Fetch budget line items for coverage data
  useEffect(() => {
    async function fetchBudget() {
      try {
        const params = new URLSearchParams();
        if (siteId) params.set("siteId", siteId);
        if (commodityId) params.set("commodityId", commodityId);
        const res = await fetch(`${API_BASE}/api/budget/coverage?orgId=${orgId}&${params}`);
        if (res.ok) {
          const data = await res.json();
          // coverage endpoint returns { periods, lineitems } or similar
          if (Array.isArray(data)) {
            setBudgetData(data);
          } else if (data.lineItems) {
            setBudgetData(data.lineItems);
          }
        }
      } catch {
        // Budget data optional — graceful degradation
      }
    }
    if (orgId) fetchBudget();
  }, [orgId, siteId, commodityId]);

  const grouped = useMemo((): BudgetMonthGroup[] => {
    // Group allocations by budget_month
    const allocMap = new Map<string, HedgeBookEntry[]>();
    for (const e of entries) {
      const key = e.budget_month ?? "Unassigned";
      if (!allocMap.has(key)) allocMap.set(key, []);
      allocMap.get(key)!.push(e);
    }

    // Build budget month lookup
    const budgetMap = new Map<string, BudgetLineItem>();
    for (const li of budgetData) {
      budgetMap.set(li.budget_month, li);
    }

    // Merge: include all months from both sources
    const allMonths = new Set([...allocMap.keys(), ...budgetMap.keys()]);

    return Array.from(allMonths)
      .sort()
      .map((month) => {
        const allocs = allocMap.get(month) ?? [];
        const budget = budgetMap.get(month);
        const hedgedVolume = allocs
          .filter((a) => a.status !== "cancelled")
          .reduce((sum, a) => sum + Number(a.allocated_volume), 0);
        const budgetedVolume = budget ? Number(budget.budgeted_volume) : 0;
        const committedVolume = budget ? Number(budget.committed_volume) : 0;
        const coveragePct = budgetedVolume > 0 ? hedgedVolume / budgetedVolume : 0;

        // VWAP of hedged prices
        let avgHedgedPrice: number | null = null;
        const pricedAllocs = allocs.filter((a) => a.trade_price && a.status !== "cancelled");
        if (pricedAllocs.length > 0) {
          const totalCost = pricedAllocs.reduce((s, a) => s + Number(a.trade_price) * Number(a.allocated_volume), 0);
          const totalVol = pricedAllocs.reduce((s, a) => s + Number(a.allocated_volume), 0);
          avgHedgedPrice = totalVol > 0 ? totalCost / totalVol : null;
        }

        return {
          month,
          budgetedVolume,
          hedgedVolume,
          committedVolume,
          coveragePct,
          avgHedgedPrice,
          allocations: allocs,
        };
      });
  }, [entries, budgetData]);

  return (
    <div className="rounded-lg border border-b-default bg-surface">
      <div className="border-b border-tbl-border px-4 py-3">
        <h2 className="text-sm font-semibold text-secondary">Budget Month View</h2>
        <p className="text-xs text-faint mt-0.5">Allocations grouped by budget month — coverage vs budget</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tbl-border bg-tbl-header">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budgeted</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Hedged</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Committed</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Coverage</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Avg Price</th>
          </tr>
        </thead>
        <tbody>
          {grouped.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-muted">
                No budget months with data.
              </td>
            </tr>
          ) : (
            grouped.map((g) => {
              const isExpanded = expandedMonth === g.month;
              const coverageColor =
                g.coveragePct >= 0.8 ? "text-profit" :
                g.coveragePct >= 0.5 ? "text-warning" :
                g.coveragePct > 0 ? "text-loss" : "text-faint";

              return (
                <BudgetMonthGroupRow
                  key={g.month}
                  group={g}
                  coverageColor={coverageColor}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedMonth(isExpanded ? null : g.month)}
                  onCancelAllocation={onCancelAllocation}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function BudgetMonthGroupRow({
  group,
  coverageColor,
  isExpanded,
  onToggle,
  onCancelAllocation,
}: {
  group: BudgetMonthGroup;
  coverageColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCancelAllocation?: (allocationId: string) => Promise<void>;
}) {
  return (
    <>
      <tr
        className="border-b border-tbl-border cursor-pointer hover:bg-row-hover transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-3 font-medium text-secondary">
          <span className="inline-flex items-center gap-2">
            <svg
              className={`h-3 w-3 text-faint transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {formatContractMonth(group.month)}
          </span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">{fmtVol(group.budgetedVolume)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{fmtVol(group.hedgedVolume)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{fmtVol(group.committedVolume)}</td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-16 rounded-full bg-input-bg overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  group.coveragePct >= 0.8 ? "bg-profit" :
                  group.coveragePct >= 0.5 ? "bg-warning" : "bg-loss"
                }`}
                style={{ width: `${Math.min(100, group.coveragePct * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium tabular-nums ${coverageColor}`}>
              {fmtPct(group.coveragePct)}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">{fmtPrice(group.avgHedgedPrice)}</td>
      </tr>

      {/* Expanded: individual allocations in this budget month */}
      {isExpanded && group.allocations.length > 0 && (
        group.allocations.map((alloc) => (
          <BudgetAllocationRow
            key={alloc.id}
            alloc={alloc}
            onCancelAllocation={onCancelAllocation}
          />
        ))
      )}
    </>
  );
}

function BudgetAllocationRow({
  alloc,
  onCancelAllocation,
}: {
  alloc: HedgeBookEntry;
  onCancelAllocation?: (allocationId: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);

  const statusColor =
    alloc.status === "open" ? "text-warning" :
    alloc.status === "efp_closed" ? "text-profit" :
    alloc.status === "offset" ? "text-muted" : "text-faint";

  const handleCancel = useCallback(async () => {
    if (!onCancelAllocation || !confirm("Cancel this allocation?")) return;
    setCancelling(true);
    try { await onCancelAllocation(alloc.id); } catch { /* store handles */ }
    finally { setCancelling(false); }
  }, [onCancelAllocation, alloc.id]);

  return (
    <tr className="border-b border-tbl-border bg-surface hover:bg-row-hover">
      <td className="px-3 py-2 pl-10 text-xs text-faint">
        {formatContractMonth(alloc.contract_month)} / {alloc.site_name ?? "—"}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        <span className={alloc.direction === "long" ? "text-profit" : "text-loss"}>
          {alloc.direction}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtVol(alloc.allocated_volume)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtPrice(alloc.trade_price)}</td>
      <td className="px-3 py-2 text-right">
        <span className={`text-xs font-medium ${statusColor}`}>{alloc.status}</span>
      </td>
      <td className="px-3 py-2 text-right">
        {alloc.status === "open" && onCancelAllocation && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-loss hover:text-loss/80 disabled:opacity-50"
          >
            {cancelling ? "..." : "Cancel"}
          </button>
        )}
      </td>
    </tr>
  );
}
