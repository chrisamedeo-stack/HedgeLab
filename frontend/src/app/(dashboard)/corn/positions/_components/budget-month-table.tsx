"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPinPlus,
  Trash2,
} from "lucide-react";
import type { MonthAllocationItem, SiteAllocationItem } from "@/hooks/useCorn";
import { fmtVol, fmtPerBu, inputCls, btnPrimary, btnSecondary } from "@/lib/corn-format";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import { SideBadge } from "@/components/ui/Badge";
import type { SiteOption, BudgetMonthGroup } from "./shared";
import type { usePermissions } from "./permissions";

// ─── Column group header styles ─────────────────────────────────────────────

const groupHeaderCls = "px-4 py-1.5 text-[10px] font-bold text-faint uppercase tracking-widest bg-input-bg/60 border-b border-b-input";
const colHeaderCls = "px-4 py-2 text-left text-xs font-semibold text-ph uppercase tracking-wider whitespace-nowrap";
const groupBorderR = "border-r border-b-input/30";

// ─── Component ───────────────────────────────────────────────────────────────

interface BudgetMonthTableProps {
  monthAllocations: MonthAllocationItem[];
  siteAllocations: SiteAllocationItem[];
  sites: SiteOption[];
  can: ReturnType<typeof usePermissions>["can"];
  onRefresh: () => void;
  onUndoAllocation: (allocationId: number, tradeRef: string) => void;
}

export function BudgetMonthTable({
  monthAllocations,
  siteAllocations,
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
        return { budgetMonth, monthOnly, siteAssigned, totalLots, totalBu };
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
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />}
              <span className="bg-accent-10 text-accent ring-1 ring-accent-20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                {g.budgetMonth}
              </span>
              <span className="text-sm text-secondary">{g.totalLots} lots</span>
              <span className="text-sm text-faint">{fmtVol(g.totalBu)} bu</span>
              {unassignedCount > 0 && (
                <span className="bg-warning-15 text-warning ring-1 ring-warning-25 px-2 py-0.5 rounded text-xs font-medium">
                  {unassignedCount} unassigned
                </span>
              )}
              <span className="text-xs text-ph ml-auto">
                {g.siteAssigned.length} site-assigned
              </span>
            </button>

            {isExpanded && (
              <div className="bg-input-bg/20 animate-slide-down">
                <table className="w-full text-sm">
                  <thead>
                    {/* Group header row */}
                    <tr>
                      <th colSpan={3} className={cn(groupHeaderCls, groupBorderR)}>Trade Info</th>
                      <th colSpan={3} className={cn(groupHeaderCls, groupBorderR)}>Allocation</th>
                      <th colSpan={1} className={cn(groupHeaderCls, groupBorderR)}>Pricing</th>
                      <th colSpan={1} className={cn(groupHeaderCls, groupBorderR)}>Site</th>
                      <th colSpan={1} className={groupHeaderCls}>Actions</th>
                    </tr>
                    {/* Column header row */}
                    <tr className="bg-input-bg/40">
                      <th className={colHeaderCls}>Trade Ref</th>
                      <th className={colHeaderCls}>Direction</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Trade Date</th>
                      <th className={colHeaderCls}>ZC Month</th>
                      <th className={colHeaderCls}>Lots</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Bushels</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Entry $/bu</th>
                      <th className={cn(colHeaderCls, groupBorderR)}>Site</th>
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
                            {/* Trade Info */}
                            <td className="px-4 py-2 font-mono text-secondary text-xs">{a.tradeRef}</td>
                            <td className="px-4 py-2">
                              <SideBadge side={a.side || "LONG"} />
                            </td>
                            <td className={cn("px-4 py-2 text-faint text-xs font-mono", groupBorderR)}>{a.tradeDate}</td>
                            {/* Allocation */}
                            <td className="px-4 py-2">
                              <span className="bg-action-10 text-action ring-1 ring-action-20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                            </td>
                            <td className="px-4 py-2 text-secondary tabular-nums">{a.allocatedLots}</td>
                            <td className={cn("px-4 py-2 text-secondary tabular-nums", groupBorderR)}>{fmtVol(a.allocatedBushels)}</td>
                            {/* Pricing */}
                            <td className={cn("px-4 py-2 text-secondary font-mono tabular-nums", groupBorderR)}>{fmtPerBu(a.entryPrice)}</td>
                            {/* Site */}
                            <td className={cn("px-4 py-2", groupBorderR)}>
                              <span className="italic text-warning text-xs">Unassigned</span>
                            </td>
                            {/* Actions */}
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
                                    className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-destructive/30 text-secondary hover:text-destructive rounded-lg text-xs font-medium transition-colors"
                                    title="Remove allocation"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isAssigning && (
                            <tr className="border-t border-b-default">
                              <td colSpan={9} className="px-4 py-3">
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
                                  <button onClick={() => setAssigningId(null)} className={btnSecondary}>Cancel</button>
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
                        {/* Trade Info */}
                        <td className="px-4 py-2 font-mono text-secondary text-xs">{a.tradeRef}</td>
                        <td className="px-4 py-2">
                          <SideBadge side={a.side || "LONG"} />
                        </td>
                        <td className={cn("px-4 py-2 text-faint text-xs font-mono", groupBorderR)}>{a.tradeDate}</td>
                        {/* Allocation */}
                        <td className="px-4 py-2">
                          <span className="bg-action-10 text-action ring-1 ring-action-20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                        </td>
                        <td className="px-4 py-2 text-secondary tabular-nums">{a.allocatedLots}</td>
                        <td className={cn("px-4 py-2 text-secondary tabular-nums", groupBorderR)}>{fmtVol(a.allocatedBushels)}</td>
                        {/* Pricing */}
                        <td className={cn("px-4 py-2 text-secondary font-mono tabular-nums", groupBorderR)}>{fmtPerBu(a.entryPrice)}</td>
                        {/* Site */}
                        <td className={cn("px-4 py-2", groupBorderR)}>
                          <span className="bg-input-bg text-secondary px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-2">
                          {can("undo-allocation") && (
                            <button
                              onClick={() => onUndoAllocation(a.allocationId, a.tradeRef)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-destructive/30 text-secondary hover:text-destructive rounded-lg text-xs font-medium transition-colors"
                              title="Remove allocation"
                            >
                              <Trash2 className="h-3 w-3" />
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
