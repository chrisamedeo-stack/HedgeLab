"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import type { HedgeBookItem } from "@/hooks/useCorn";
import { fmtVol, fmtPerBu, fmtPnl, pnlColor } from "@/lib/corn-format";
import { cn } from "@/lib/utils";
import { SideBadge } from "@/components/ui/Badge";
import { AllocateForm } from "./allocate-form";
import type { SiteOption, FuturesMonthGroup } from "./shared";
import type { usePermissions } from "./permissions";

const colHeaderCls = "px-4 py-2 text-left text-xs font-semibold text-ph uppercase tracking-wider whitespace-nowrap";

// ─── Component ───────────────────────────────────────────────────────────────

interface DeliveryMonthTableProps {
  hedgeBook: HedgeBookItem[];
  sites: SiteOption[];
  can: ReturnType<typeof usePermissions>["can"];
  onRefresh: () => void;
  onEdit: (tradeId: number) => void;
  onDelete: (tradeId: number) => void;
}

export function DeliveryMonthTable({
  hedgeBook,
  sites,
  can,
  onRefresh,
  onEdit,
  onDelete,
}: DeliveryMonthTableProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [allocTradeId, setAllocTradeId] = useState<number | null>(null);

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
        const settleItems = items.filter((i) => i.settlePrice != null);
        const settleSumWt = settleItems.reduce((s, i) => s + i.openLots * (i.settlePrice ?? 0), 0);
        const settleSumLots = settleItems.reduce((s, i) => s + i.openLots, 0);
        const avgSettle = settleSumLots > 0 ? settleSumWt / settleSumLots : null;
        return { futuresMonth: fm, items, totalBu, unallocBu, totalLots, wtdAvgEntry, totalMtm, avgSettle };
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
        <div className="px-4 py-8 text-center text-faint text-sm">All trades fully allocated</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.futuresMonth;
        return (
          <Fragment key={g.futuresMonth}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.futuresMonth)}
              className="w-full grid grid-cols-[24px_120px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />}
              <span className="bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold text-center">
                {g.futuresMonth}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Lots</span>
                <span className="text-sm text-secondary tabular-nums">{g.totalLots}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Bushels</span>
                <span className="text-sm text-secondary tabular-nums">{fmtVol(g.totalBu)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Alloc Bu</span>
                <span className="text-sm text-secondary tabular-nums">{fmtVol(g.totalBu - g.unallocBu)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Unalloc Bu</span>
                <span className="text-sm text-profit tabular-nums font-semibold">{fmtVol(g.unallocBu)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">VWAP</span>
                <span className="text-sm text-secondary font-mono tabular-nums">{fmtPerBu(g.wtdAvgEntry)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Mkt Price</span>
                <span className="text-sm text-secondary font-mono tabular-nums">{g.avgSettle != null ? fmtPerBu(g.avgSettle) : "\u2013"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">MTM</span>
                <span className={cn("text-sm font-semibold tabular-nums", pnlColor(g.totalMtm))}>{fmtPnl(g.totalMtm)}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-ph">{g.items.length} trades</span>
              </div>
            </button>

            {isExpanded && (
              <div className="bg-input-bg/20 animate-slide-down">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-tbl-header">
                      <th className={colHeaderCls}>Ref</th>
                      <th className={colHeaderCls}>Side</th>
                      <th className={colHeaderCls}>Lots</th>
                      <th className={colHeaderCls}>Unalloc Bu</th>
                      <th className={colHeaderCls}>Entry $/bu</th>
                      <th className={colHeaderCls}>Settle $/bu</th>
                      <th className={colHeaderCls}>MTM P&amp;L</th>
                      <th className={colHeaderCls} />
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((h) => {
                      const isAlloc = allocTradeId === h.hedgeTradeId;
                      return (
                        <Fragment key={h.hedgeTradeId}>
                          <tr className="border-t border-b-default hover:bg-row-hover transition-colors">
                            <td className="px-4 py-2 font-mono text-secondary text-xs">{h.tradeRef}</td>
                            <td className="px-4 py-2"><SideBadge side={h.side || "LONG"} /></td>
                            <td className="px-4 py-2 text-secondary tabular-nums">{h.unallocatedLots}</td>
                            <td className="px-4 py-2 font-semibold text-profit tabular-nums">{fmtVol(h.unallocatedBushels)}</td>
                            <td className="px-4 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(h.entryPrice)}</td>
                            <td className="px-4 py-2 font-mono tabular-nums">
                              {h.settlePrice != null ? (
                                <span className="text-secondary">{fmtPerBu(h.settlePrice)}</span>
                              ) : (
                                <span className="text-ph italic text-xs">no settle</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {h.mtmPnlUsd != null ? (
                                <span className={cn("flex items-center gap-1 font-semibold tabular-nums", pnlColor(h.mtmPnlUsd))}>
                                  {h.mtmPnlUsd > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : h.mtmPnlUsd < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  {fmtPnl(h.mtmPnlUsd)}
                                </span>
                              ) : <span className="text-ph italic text-xs">&ndash;</span>}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                {can("allocate") && (
                                  <button
                                    onClick={() => setAllocTradeId(isAlloc ? null : h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-hover border border-b-input text-secondary rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Allocate
                                  </button>
                                )}
                                {can("edit-hedge") && (
                                  <button
                                    onClick={() => onEdit(h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-hover border border-b-input text-secondary text-xs rounded-lg transition-colors"
                                    title="Edit trade"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                )}
                                {can("delete-hedge") && h.allocatedLots === 0 && (
                                  <button
                                    onClick={() => onDelete(h.hedgeTradeId)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-destructive/20 border border-b-input text-secondary hover:text-destructive text-xs rounded-lg transition-colors"
                                    title="Delete trade"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isAlloc && (
                            <tr className="border-t border-b-default animate-slide-down">
                              <td colSpan={8} className="px-4 py-2">
                                <AllocateForm hedge={h} sites={sites} onDone={handleAllocDone} onCancel={() => setAllocTradeId(null)} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {/* Group summary */}
                    <tr className="border-t border-b-default bg-tbl-header font-semibold text-xs">
                      <td className="px-4 py-1.5 text-faint" colSpan={2}>Total</td>
                      <td className="px-4 py-1.5 text-secondary tabular-nums">{g.items.reduce((s, i) => s + i.unallocatedLots, 0)}</td>
                      <td className="px-4 py-1.5 text-secondary tabular-nums">{fmtVol(g.unallocBu)}</td>
                      <td className="px-4 py-1.5 text-secondary font-mono tabular-nums">{fmtPerBu(g.wtdAvgEntry)}</td>
                      <td colSpan={3} />
                    </tr>
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
