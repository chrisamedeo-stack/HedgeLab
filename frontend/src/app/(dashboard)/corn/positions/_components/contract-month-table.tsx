"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  Edit2,
  Trash2,
} from "lucide-react";
import type { HedgeBookItem } from "@/hooks/useCorn";
import { fmtVol, fmtPerBu, fmtPnl, pnlColor } from "@/lib/corn-format";
import { cn } from "@/lib/utils";
import { AllocationStatusBadge } from "./allocation-status-badge";
import { AllocateForm } from "./allocate-form";
import { AllocationBreakdown } from "./allocation-breakdown";
import type { SiteOption, FuturesMonthGroup } from "./shared";
import type { usePermissions } from "./permissions";

// ─── Column group header styles ─────────────────────────────────────────────

const groupHeaderCls = "px-4 py-1.5 text-[10px] font-bold text-faint uppercase tracking-widest bg-input-bg/60 border-b border-b-input";
const colHeaderCls = "px-4 py-2 text-left text-xs font-semibold text-ph uppercase tracking-wider whitespace-nowrap";
const groupBorderR = "border-r border-b-input/30";

// ─── Component ───────────────────────────────────────────────────────────────

interface ContractMonthTableProps {
  hedgeBook: HedgeBookItem[];
  sites: SiteOption[];
  can: ReturnType<typeof usePermissions>["can"];
  onRefresh: () => void;
  onEdit: (tradeId: number) => void;
  onDelete: (tradeId: number) => void;
  onUndoAllocation: (allocationId: number, tradeRef: string) => void;
}

export function ContractMonthTable({
  hedgeBook,
  sites,
  can,
  onRefresh,
  onEdit,
  onDelete,
  onUndoAllocation,
}: ContractMonthTableProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [allocTradeId, setAllocTradeId] = useState<number | null>(null);
  const [breakdownTradeId, setBreakdownTradeId] = useState<number | null>(null);

  const groups: FuturesMonthGroup[] = useMemo(() => {
    const map = new Map<string, HedgeBookItem[]>();
    for (const item of hedgeBook) {
      const list = map.get(item.futuresMonth) || [];
      list.push(item);
      map.set(item.futuresMonth, list);
    }
    return Array.from(map.entries())
      .map(([fm, items]) => {
        const totalBu = items.reduce((s, i) => s + i.bushels, 0);
        const unallocBu = items.reduce((s, i) => s + i.unallocatedBushels, 0);
        const totalLots = items.reduce((s, i) => s + i.lots, 0);
        const totalMtm = items.reduce((s, i) => s + (i.mtmPnlUsd ?? 0), 0);
        const sumWt = items.reduce((s, i) => s + i.openLots * (i.entryPrice ?? 0), 0);
        const sumLots = items.reduce((s, i) => s + i.openLots, 0);
        const wtdAvgEntry = sumLots > 0 ? sumWt / sumLots : 0;
        return { futuresMonth: fm, items, totalBu, unallocBu, totalLots, wtdAvgEntry, totalMtm };
      })
      .sort((a, b) => a.futuresMonth.localeCompare(b.futuresMonth));
  }, [hedgeBook]);

  function handleAllocDone() {
    setAllocTradeId(null);
    onRefresh();
  }

  return (
    <div className="divide-y divide-b-default">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-faint text-sm">No hedge positions</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.futuresMonth;
        return (
          <Fragment key={g.futuresMonth}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.futuresMonth)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />}
              <span className="bg-action-10 text-action ring-1 ring-action-20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                {g.futuresMonth}
              </span>
              <span className="text-sm text-secondary">{fmtVol(g.totalBu)} bu</span>
              <span className="text-sm text-faint">{fmtVol(g.unallocBu)} unalloc</span>
              <span className="text-sm text-muted font-mono">Avg {fmtPerBu(g.wtdAvgEntry)}</span>
              <span className={cn("text-sm font-semibold", pnlColor(g.totalMtm))}>
                {fmtPnl(g.totalMtm)}
              </span>
              <span className="text-xs text-ph ml-auto">{g.totalLots} lots</span>
            </button>

            {isExpanded && (
              <div className="bg-input-bg/20 animate-slide-down">
                <table className="w-full text-sm">
                  <thead>
                    {/* Group header row */}
                    <tr>
                      <th colSpan={2} className={cn(groupHeaderCls, groupBorderR)}>Trade Info</th>
                      <th colSpan={3} className={cn(groupHeaderCls, groupBorderR)}>Volume</th>
                      <th colSpan={2} className={cn(groupHeaderCls, groupBorderR)}>Pricing</th>
                      <th colSpan={1} className={cn(groupHeaderCls, groupBorderR)}>MTM</th>
                      <th colSpan={1} className={groupHeaderCls}>Actions</th>
                    </tr>
                    {/* Column header row */}
                    <tr className="bg-input-bg/40">
                      <th className={colHeaderCls}>Ref</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Status</th>
                      <th className={colHeaderCls}>Total Bu</th>
                      <th className={colHeaderCls}>Alloc Bu</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Unalloc Bu</th>
                      <th className={colHeaderCls}>Entry $/bu</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Settle $/bu</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>MTM P&amp;L</th>
                      <th className={colHeaderCls} />
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((h) => {
                      const isAlloc = allocTradeId === h.hedgeTradeId;
                      const isBreakdown = breakdownTradeId === h.hedgeTradeId;
                      const hasAllocations = h.allocatedLots > 0;
                      const fullyAllocated = h.unallocatedLots === 0;
                      return (
                        <Fragment key={h.hedgeTradeId}>
                          <tr className="border-t border-b-default hover:bg-row-hover transition-colors">
                            {/* Trade Info */}
                            <td className="px-4 py-2 font-mono text-secondary text-xs">{h.tradeRef}</td>
                            <td className={cn("px-4 py-2", groupBorderR)}>
                              <AllocationStatusBadge item={h} />
                            </td>
                            {/* Volume */}
                            <td className="px-4 py-2 text-secondary tabular-nums">{fmtVol(h.bushels)}</td>
                            <td className="px-4 py-2 text-faint tabular-nums">{fmtVol(h.allocatedBushels)}</td>
                            <td className={cn("px-4 py-2 font-semibold tabular-nums", groupBorderR, fullyAllocated ? "text-faint" : "text-profit")}>
                              {fmtVol(h.unallocatedBushels)}
                            </td>
                            {/* Pricing */}
                            <td className="px-4 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(h.entryPrice)}</td>
                            <td className={cn("px-4 py-2 font-mono tabular-nums", groupBorderR)}>
                              {h.settlePrice != null ? (
                                <span className="text-secondary">{fmtPerBu(h.settlePrice)}</span>
                              ) : (
                                <span className="text-ph italic text-xs">no settle</span>
                              )}
                            </td>
                            {/* MTM */}
                            <td className={cn("px-4 py-2", groupBorderR)}>
                              {h.mtmPnlUsd != null ? (
                                <span className={cn("flex items-center gap-1 font-semibold tabular-nums", pnlColor(h.mtmPnlUsd))}>
                                  {h.mtmPnlUsd > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : h.mtmPnlUsd < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  {fmtPnl(h.mtmPnlUsd)}
                                </span>
                              ) : <span className="text-ph italic text-xs">&ndash;</span>}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                {hasAllocations && (
                                  <button
                                    onClick={() => setBreakdownTradeId(isBreakdown ? null : h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                                    title="View allocation breakdown"
                                  >
                                    {isBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                )}
                                {can("allocate") && !fullyAllocated && (
                                  <button
                                    onClick={() => setAllocTradeId(isAlloc ? null : h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-profit-20 hover:bg-profit-40 text-profit rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" /> Alloc
                                  </button>
                                )}
                                {can("edit-hedge") && !hasAllocations && (
                                  <button
                                    onClick={() => onEdit(h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                                    title="Edit trade"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                )}
                                {can("delete-hedge") && !hasAllocations && (
                                  <button
                                    onClick={() => onDelete(h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-destructive/30 text-secondary hover:text-destructive rounded-lg text-xs font-medium transition-colors"
                                    title="Delete trade"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isBreakdown && (
                            <tr className="border-t border-b-default bg-input-bg/10 animate-slide-down">
                              <td colSpan={9}>
                                <AllocationBreakdown tradeId={h.hedgeTradeId} can={can} onUndo={onUndoAllocation} />
                              </td>
                            </tr>
                          )}
                          {isAlloc && (
                            <tr className="border-t border-b-default animate-slide-down">
                              <td colSpan={9} className="px-4 py-2">
                                <AllocateForm hedge={h} sites={sites} onDone={handleAllocDone} onCancel={() => setAllocTradeId(null)} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
