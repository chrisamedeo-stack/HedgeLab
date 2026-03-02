"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPinPlus,
  ArrowRightLeft,
  Plus,
  Undo2,
} from "lucide-react";
import type { HedgeBookItem, MonthAllocationItem, SiteAllocationItem } from "@/hooks/useCorn";
import { fmtVol, fmtBu, fmtPerBu, fmtPnl, pnlColor, inputCls, btnPrimary, btnCancel } from "@/lib/corn-format";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import { SideBadge } from "@/components/ui/Badge";
import type { SiteOption, BudgetMonthGroup } from "./shared";
import { fmtBudgetMonth } from "./shared";
import type { usePermissions } from "./permissions";

const colHeaderCls = "px-4 py-2 text-left text-xs font-semibold text-ph uppercase tracking-wider whitespace-nowrap";

// ─── Component ───────────────────────────────────────────────────────────────

interface BudgetMonthTableProps {
  monthAllocations: MonthAllocationItem[];
  siteAllocations: SiteAllocationItem[];
  hedgeBook: HedgeBookItem[];
  sites: SiteOption[];
  can: ReturnType<typeof usePermissions>["can"];
  onRefresh: () => void;
  onUndoAllocation: (allocationId: number, tradeRef: string) => void;
}

export function BudgetMonthTable({
  monthAllocations,
  siteAllocations,
  hedgeBook,
  sites,
  can,
  onRefresh,
  onUndoAllocation,
}: BudgetMonthTableProps) {
  const toast = useToast();
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignSite, setAssignSite] = useState("");
  const [saving, setSaving] = useState(false);

  // Allocate-from-budget-month state
  const [allocMonth, setAllocMonth] = useState<string | null>(null);
  const [allocHedgeId, setAllocHedgeId] = useState<string>("");
  const [allocSite, setAllocSite] = useState("");
  const [allocBushels, setAllocBushels] = useState("");
  const [allocSaving, setAllocSaving] = useState(false);

  const unallocatedHedges = hedgeBook.filter((h) => h.unallocatedLots > 0);

  const groups: BudgetMonthGroup[] = useMemo(() => {
    const map = new Map<string, { monthOnly: MonthAllocationItem[]; siteAssigned: SiteAllocationItem[] }>();

    for (const a of monthAllocations) {
      const entry = map.get(a.budgetMonth) || { monthOnly: [], siteAssigned: [] };
      entry.monthOnly.push(a);
      map.set(a.budgetMonth, entry);
    }
    for (const a of siteAllocations) {
      const entry = map.get(a.budgetMonth) || { monthOnly: [], siteAssigned: [] };
      entry.siteAssigned.push(a);
      map.set(a.budgetMonth, entry);
    }

    return Array.from(map.entries())
      .map(([budgetMonth, { monthOnly, siteAssigned }]) => {
        const totalLots = monthOnly.reduce((s, a) => s + a.allocatedLots, 0) + siteAssigned.reduce((s, a) => s + a.allocatedLots, 0);
        const totalBu = totalLots * 5000;
        const allAllocs = [...monthOnly, ...siteAssigned];
        const sumWt = allAllocs.reduce((s, a) => s + a.allocatedLots * a.entryPrice, 0);
        const sumLots = allAllocs.reduce((s, a) => s + a.allocatedLots, 0);
        const vwap = sumLots > 0 ? sumWt / sumLots : 0;
        const totalMtm = siteAssigned.reduce((s, a) => s + (a.mtmPnlUsd ?? 0), 0);
        const settleItems = siteAssigned.filter((a) => a.settlePrice != null);
        const settleSumWt = settleItems.reduce((s, a) => s + a.allocatedLots * (a.settlePrice ?? 0), 0);
        const settleSumLots = settleItems.reduce((s, a) => s + a.allocatedLots, 0);
        const avgSettle = settleSumLots > 0 ? settleSumWt / settleSumLots : null;
        return { budgetMonth, monthOnly, siteAssigned, totalLots, totalBu, vwap, totalMtm, avgSettle };
      })
      .sort((a, b) => a.budgetMonth.localeCompare(b.budgetMonth));
  }, [monthAllocations, siteAllocations]);

  async function handleAssignSite(allocationId: number) {
    if (!assignSite) {
      toast.toast("Select a site", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/v1/corn/hedges/allocations/${allocationId}/assign-site`, {
        siteCode: assignSite,
      });
      toast.toast("Site assigned", "success");
      setAssigningId(null);
      setAssignSite("");
      onRefresh();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to assign site", "error");
    } finally {
      setSaving(false);
    }
  }

  function openAllocForm(budgetMonth: string) {
    setAllocMonth(budgetMonth);
    setAllocHedgeId("");
    setAllocSite("");
    setAllocBushels("");
  }

  function closeAllocForm() {
    setAllocMonth(null);
    setAllocHedgeId("");
    setAllocSite("");
    setAllocBushels("");
  }

  async function handleAllocate(budgetMonth: string) {
    const hedge = unallocatedHedges.find((h) => String(h.hedgeTradeId) === allocHedgeId);
    if (!hedge) { toast.toast("Select a hedge trade", "error"); return; }
    if (!allocSite) { toast.toast("Select a site", "error"); return; }
    const bu = parseInt(allocBushels);
    if (!bu || bu <= 0) { toast.toast("Enter bushels", "error"); return; }
    if (bu > hedge.unallocatedBushels) {
      toast.toast(`Max ${fmtBu(hedge.unallocatedBushels)} bu available`, "error");
      return;
    }
    const lots = Math.round(bu / 5000);
    if (lots <= 0) { toast.toast("Min 5,000 bu (1 lot)", "error"); return; }
    setAllocSaving(true);
    try {
      await api.post(`/api/v1/corn/hedges/${hedge.hedgeTradeId}/allocations`, {
        siteCode: allocSite,
        budgetMonth,
        allocatedLots: lots,
      });
      toast.toast(`Allocated ${fmtBu(lots * 5000)} bu → ${allocSite} · ${fmtBudgetMonth(budgetMonth)}`, "success");
      closeAllocForm();
      onRefresh();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Allocation failed", "error");
    } finally {
      setAllocSaving(false);
    }
  }

  return (
    <div className="divide-y divide-b-default">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-faint text-sm">No allocations yet</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.budgetMonth;
        const unassignedCount = g.monthOnly.length;
        return (
          <Fragment key={g.budgetMonth}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.budgetMonth)}
              className="w-full grid grid-cols-[24px_auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />}
              <div className="flex items-center gap-2 min-w-[120px]">
                <span className="bg-accent-10 text-accent ring-1 ring-accent-20 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap">
                  {fmtBudgetMonth(g.budgetMonth)}
                </span>
                {Array.from(new Set([...g.monthOnly, ...g.siteAssigned].map((a) => a.futuresMonth))).sort().map((fm) => (
                  <span key={fm} className="bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold whitespace-nowrap">
                    {fm}
                  </span>
                ))}
              </div>
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
                <span className="text-sm text-secondary tabular-nums">{fmtVol(g.siteAssigned.reduce((s, a) => s + a.allocatedBushels, 0))}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Unassigned Bu</span>
                <span className="text-sm text-warning tabular-nums font-semibold">{fmtVol(g.monthOnly.reduce((s, a) => s + a.allocatedBushels, 0))}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">VWAP</span>
                <span className="text-sm text-secondary font-mono tabular-nums">{fmtPerBu(g.vwap)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">Mkt Price</span>
                <span className="text-sm text-secondary font-mono tabular-nums">{g.avgSettle != null ? fmtPerBu(g.avgSettle) : "\u2013"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-ph leading-tight">MTM</span>
                <span className={cn("text-sm font-semibold tabular-nums", pnlColor(g.totalMtm))}>{fmtPnl(g.totalMtm)}</span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {unassignedCount > 0 && (
                  <span className="bg-warning-15 text-warning ring-1 ring-warning-25 px-2 py-0.5 rounded text-xs font-medium">
                    {unassignedCount} unassigned
                  </span>
                )}
                {can("allocate") && unallocatedHedges.length > 0 && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); openAllocForm(g.budgetMonth); }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-hover border border-b-input text-secondary text-xs rounded-lg transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Allocate
                  </span>
                )}
              </div>
            </button>

            {/* Inline allocate form (shows even when collapsed) */}
            {allocMonth === g.budgetMonth && (
              <div className="bg-input-bg border-b border-b-default px-5 py-4 animate-slide-down">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="h-4 w-4 text-profit" />
                  <span className="text-sm font-semibold text-profit">
                    Allocate to {fmtBudgetMonth(g.budgetMonth)}
                  </span>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-faint">Hedge Trade</label>
                    <select value={allocHedgeId} onChange={(e) => { setAllocHedgeId(e.target.value); setAllocBushels(""); }} className={inputCls}>
                      <option value="">Select trade&hellip;</option>
                      {unallocatedHedges.map((h) => (
                        <option key={h.hedgeTradeId} value={h.hedgeTradeId}>
                          {h.tradeRef} · {h.futuresMonth} · {fmtBu(h.unallocatedBushels)} bu avail
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-faint">Site</label>
                    <select value={allocSite} onChange={(e) => setAllocSite(e.target.value)} className={inputCls}>
                      <option value="">Select site&hellip;</option>
                      {sites.map((s) => (
                        <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-faint">Bushels</label>
                    <input
                      type="number"
                      step={5000}
                      min={5000}
                      max={allocHedgeId ? unallocatedHedges.find((h) => String(h.hedgeTradeId) === allocHedgeId)?.unallocatedBushels : undefined}
                      placeholder="e.g. 25000"
                      value={allocBushels}
                      onChange={(e) => setAllocBushels(e.target.value)}
                      className={cn(inputCls, "w-36")}
                    />
                  </div>
                  <div className="text-xs text-faint pb-1.5">
                    {allocBushels ? `${Math.round(parseInt(allocBushels) / 5000)} lots` : ""}
                  </div>
                  <button onClick={() => handleAllocate(g.budgetMonth)} disabled={allocSaving || !allocHedgeId || !allocSite || !allocBushels} className={btnPrimary}>
                    {allocSaving ? "Allocating\u2026" : "Allocate"}
                  </button>
                  <button onClick={closeAllocForm} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            {isExpanded && (
              <div className="bg-input-bg/20 animate-slide-down">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-tbl-header">
                      <th className={colHeaderCls}>Trade Ref</th>
                      <th className={colHeaderCls}>Side</th>
                      <th className={colHeaderCls}>ZC Month</th>
                      <th className={colHeaderCls}>Lots</th>
                      <th className={colHeaderCls}>Bushels</th>
                      <th className={colHeaderCls}>Entry $/bu</th>
                      <th className={colHeaderCls}>Settle $/bu</th>
                      <th className={colHeaderCls}>MTM P&amp;L</th>
                      <th className={colHeaderCls}>Site</th>
                      <th className={colHeaderCls} />
                    </tr>
                  </thead>
                  <tbody>
                    {/* Month-only allocations (no site) */}
                    {g.monthOnly.map((a) => {
                      const isAssigning = assigningId === a.allocationId;
                      return (
                        <Fragment key={`mo-${a.allocationId}`}>
                          <tr className="border-t border-b-default hover:bg-row-hover transition-colors bg-warning-5">
                            <td className="px-4 py-2 font-mono text-secondary text-xs">{a.tradeRef}</td>
                            <td className="px-4 py-2"><SideBadge side={a.side || "LONG"} /></td>
                            <td className="px-4 py-2">
                              <span className="bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                            </td>
                            <td className="px-4 py-2 text-secondary tabular-nums">{a.allocatedLots}</td>
                            <td className="px-4 py-2 text-secondary tabular-nums">{fmtVol(a.allocatedBushels)}</td>
                            <td className="px-4 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(a.entryPrice)}</td>
                            <td className="px-4 py-2 text-faint">&mdash;</td>
                            <td className="px-4 py-2 text-faint">&mdash;</td>
                            <td className="px-4 py-2">
                              <span className="italic text-warning text-xs">Unassigned</span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                {can("assign-site") && (
                                  <button
                                    onClick={() => { setAssigningId(isAssigning ? null : a.allocationId); setAssignSite(""); }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-accent-20 hover:bg-accent-40 text-accent rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <MapPinPlus className="h-3 w-3" /> Assign Site
                                  </button>
                                )}
                                {can("undo-allocation") && (
                                  <button
                                    onClick={() => onUndoAllocation(a.allocationId, a.tradeRef)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-warning/20 border border-b-input text-secondary hover:text-warning text-xs rounded-lg transition-colors"
                                    title="Undo allocation"
                                  >
                                    <Undo2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isAssigning && (
                            <tr className="border-t border-b-default">
                              <td colSpan={10} className="px-4 py-3">
                                <div className="flex items-end gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs text-faint">Site</label>
                                    <select value={assignSite} onChange={(e) => setAssignSite(e.target.value)} className={inputCls}>
                                      <option value="">Select site&hellip;</option>
                                      {sites.map((s) => (
                                        <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button onClick={() => handleAssignSite(a.allocationId)} disabled={saving || !assignSite} className={btnPrimary}>
                                    {saving ? "Assigning\u2026" : "Assign"}
                                  </button>
                                  <button onClick={() => setAssigningId(null)} className={btnCancel}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {/* Site-assigned allocations */}
                    {g.siteAssigned.map((a) => (
                      <tr key={`sa-${a.allocationId}`} className="border-t border-b-default hover:bg-row-hover transition-colors">
                        <td className="px-4 py-2 font-mono text-secondary text-xs">{a.tradeRef}</td>
                        <td className="px-4 py-2"><SideBadge side={a.side || "LONG"} /></td>
                        <td className="px-4 py-2">
                          <span className="bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                        </td>
                        <td className="px-4 py-2 text-secondary tabular-nums">{a.allocatedLots}</td>
                        <td className="px-4 py-2 text-secondary tabular-nums">{fmtVol(a.allocatedBushels)}</td>
                        <td className="px-4 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(a.entryPrice)}</td>
                        <td className="px-4 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(a.settlePrice)}</td>
                        <td className={cn("px-4 py-2 font-mono tabular-nums", pnlColor(a.mtmPnlUsd))}>{fmtPnl(a.mtmPnlUsd)}</td>
                        <td className="px-4 py-2">
                          <span className="bg-input-bg text-secondary px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span>
                        </td>
                        <td className="px-4 py-2">
                          {can("undo-allocation") && (
                            <button
                              onClick={() => onUndoAllocation(a.allocationId, a.tradeRef)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-input-bg hover:bg-warning/20 border border-b-input text-secondary hover:text-warning text-xs rounded-lg transition-colors"
                              title="Undo allocation"
                            >
                              <Undo2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
