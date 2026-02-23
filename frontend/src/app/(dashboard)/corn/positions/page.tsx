"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
  Plus,
  X,
  ArrowRightLeft,
  MapPinPlus,
} from "lucide-react";
import {
  usePositions,
  useSites,
  useHedgeAllocations,
  HedgeBookItem,
  SiteAllocationItem,
  MonthAllocationItem,
  OffsetItem,
} from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { BUSHELS_PER_MT } from "@/lib/corn-utils";
import {
  fmtVol,
  fmt2,
  fmtBu,
  fmtPnl,
  fmtUsd,
  centsToUsd,
  today,
  inputCls,
  btnPrimary,
  btnSecondary,
} from "@/lib/corn-format";
import type { Unit } from "@/lib/corn-format";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

// ─── Settle Publisher ────────────────────────────────────────────────────────

function SettlePublisher({
  futuresMonths,
  existingSettles,
  onDone,
}: {
  futuresMonths: string[];
  existingSettles: Record<string, number>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [settleDate, setSettleDate] = useState(today());
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    futuresMonths.forEach((fm) => {
      init[fm] = existingSettles[fm] != null ? String(existingSettles[fm] / 100) : "";
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const payload: Record<string, number> = {};
    for (const [fm, v] of Object.entries(prices)) {
      const n = parseFloat(v);
      if (!isNaN(n)) payload[fm] = n * 100;
    }
    if (Object.keys(payload).length === 0) {
      toast.toast("Enter at least one settle price", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/v1/corn/positions/settle", { settleDate, prices: payload });
      toast.toast("Settle prices published", "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to publish", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-slate-200">Publish Settle Prices</span>
        <span className="text-xs text-slate-500">Enter ZC close prices ($/bu)</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Settle Date</label>
          <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className={inputCls} />
        </div>
        {futuresMonths.map((fm) => (
          <div key={fm} className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{fm} ($/bu)</label>
            <input
              type="number"
              step="0.25"
              placeholder={existingSettles[fm] != null ? String(existingSettles[fm] / 100) : "e.g. 4.39"}
              value={prices[fm] ?? ""}
              onChange={(e) => setPrices((p) => ({ ...p, [fm]: e.target.value }))}
              className={cn(inputCls, "w-36")}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving\u2026" : "Publish"}
        </button>
        <button onClick={onDone} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Multi-Row Allocate Form ─────────────────────────────────────────────────

interface AllocRow {
  budgetMonth: string;
  siteCode: string;
  bushels: string;
}

function AllocateForm({
  hedge,
  sites,
  onDone,
  onCancel,
}: {
  hedge: HedgeBookItem;
  sites: { code: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const validMonths = hedge.validDeliveryMonths;
  const [rows, setRows] = useState<AllocRow[]>([
    { budgetMonth: validMonths[0] ?? "", siteCode: "", bushels: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const totalBu = rows.reduce((s, r) => s + (parseInt(r.bushels) || 0), 0);
  const availBu = hedge.unallocatedBushels;

  function updateRow(idx: number, field: keyof AllocRow, val: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { budgetMonth: validMonths[0] ?? "", siteCode: "", bushels: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (totalBu <= 0 || totalBu > availBu) {
      toast.toast(`Total bushels must be 1\u2013${fmtBu(availBu)}`, "error");
      return;
    }
    for (const row of rows) {
      const bu = parseInt(row.bushels);
      if (bu > 0 && !row.budgetMonth) {
        toast.toast("Budget month is required for each row", "error");
        return;
      }
    }
    setSaving(true);
    try {
      for (const row of rows) {
        const bu = parseInt(row.bushels);
        if (!bu || bu <= 0) continue;
        const lots = Math.round(bu / 5000);
        if (lots <= 0) continue;
        await api.post(`/api/v1/corn/hedges/${hedge.hedgeTradeId}/allocations`, {
          siteCode: row.siteCode || null,
          budgetMonth: row.budgetMonth,
          allocatedLots: lots,
        });
      }
      toast.toast(`Allocated ${fmtBu(totalBu)} bu from ${hedge.tradeRef}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Allocation failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/70 border border-emerald-500/30 rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-300">
          Allocate &middot; {hedge.tradeRef} ({hedge.futuresMonth})
        </span>
        <span className="ml-auto text-xs text-slate-500">{fmtBu(availBu)} bu available</span>
      </div>

      <div className="space-y-2 mb-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Budget Month</label>
              <select value={row.budgetMonth} onChange={(e) => updateRow(idx, "budgetMonth", e.target.value)} className={inputCls}>
                {validMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Site <span className="text-slate-600">(optional)</span></label>
              <select value={row.siteCode} onChange={(e) => updateRow(idx, "siteCode", e.target.value)} className={inputCls}>
                <option value="">&middot;</option>
                {sites.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Bushels</label>
              <input
                type="number"
                step={5000}
                min={5000}
                placeholder="e.g. 25000"
                value={row.bushels}
                onChange={(e) => updateRow(idx, "bushels", e.target.value)}
                className={cn(inputCls, "w-36")}
              />
            </div>
            <div className="text-xs text-slate-500 pb-1.5">
              {row.bushels ? `${Math.round(parseInt(row.bushels) / 5000)} lots` : ""}
            </div>
            {rows.length > 1 && (
              <button onClick={() => removeRow(idx)} className="pb-1.5 text-slate-500 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button onClick={addRow} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
          <Plus className="h-3 w-3" /> Add Row
        </button>
        <span className={cn("text-xs font-medium", totalBu > availBu ? "text-red-400" : "text-slate-400")}>
          Total: {fmtBu(totalBu)} / {fmtBu(availBu)} bu
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || totalBu <= 0 || totalBu > availBu} className={btnPrimary}>
          {saving ? "Allocating\u2026" : "Allocate"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Allocation Breakdown Tree (inline expand for a trade) ───────────────────

function AllocationBreakdown({ tradeId }: { tradeId: number }) {
  const { allocations, isLoading } = useHedgeAllocations(tradeId);

  if (isLoading) return <div className="px-4 py-2 text-xs text-slate-500">Loading allocations&hellip;</div>;
  if (allocations.length === 0) return <div className="px-4 py-2 text-xs text-slate-500">No allocations yet</div>;

  const byMonth = new Map<string, typeof allocations>();
  for (const a of allocations) {
    const list = byMonth.get(a.budgetMonth) || [];
    list.push(a);
    byMonth.set(a.budgetMonth, list);
  }

  const sortedMonths = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="px-4 py-2 space-y-1">
      {sortedMonths.map(([month, allocs]) => {
        const totalLots = allocs.reduce((s, a) => s + a.allocatedLots, 0);
        return (
          <div key={month} className="text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-slate-500">&boxur;</span>
              <span className="font-mono font-medium">{month}</span>
              <span className="text-slate-500">{totalLots} lots ({fmtBu(totalLots * 5000)} bu)</span>
            </div>
            {allocs.map((a) => (
              <div key={a.id} className="flex items-center gap-2 ml-6 text-slate-500">
                <span>&boxur;</span>
                {a.siteCode ? (
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{a.siteCode}</span>
                ) : (
                  <span className="italic text-slate-600">unassigned</span>
                )}
                <span>{a.allocatedLots} lots</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Hedge Book — Grouped by Futures Month ──────────────────────────────────

interface FuturesMonthGroup {
  futuresMonth: string;
  items: HedgeBookItem[];
  totalBu: number;
  unallocBu: number;
  totalLots: number;
  wtdAvgEntry: number;
  totalMtm: number;
}

function HedgeBookTable({
  hedgeBook,
  sites,
  onRefresh,
  unit,
}: {
  hedgeBook: HedgeBookItem[];
  sites: { code: string; name: string }[];
  onRefresh: () => void;
  unit: Unit;
}) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
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

  function handleDone() {
    setAllocTradeId(null);
    onRefresh();
  }

  function statusBadge(h: HedgeBookItem) {
    if (h.unallocatedLots === 0) {
      return <span className="ml-2 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25 px-2 py-0.5 rounded text-xs font-medium">ALLOCATED</span>;
    }
    if (h.allocatedLots > 0 && h.unallocatedLots > 0) {
      return <span className="ml-2 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25 px-2 py-0.5 rounded text-xs font-medium">PARTIAL</span>;
    }
    return null;
  }

  return (
    <div className="divide-y divide-slate-800">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">No hedge positions</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.futuresMonth;
        return (
          <Fragment key={g.futuresMonth}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.futuresMonth)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                {g.futuresMonth}
              </span>
              <span className="text-sm text-slate-300">{fmtVol(g.totalBu, "BU", unit)} {unitLabel}</span>
              <span className="text-sm text-slate-500">{fmtVol(g.unallocBu, "BU", unit)} unalloc</span>
              <span className="text-sm text-slate-400 font-mono">Avg {centsToUsd(g.wtdAvgEntry)}</span>
              <span className={cn("text-sm font-semibold", g.totalMtm > 0 ? "text-emerald-400" : g.totalMtm < 0 ? "text-red-400" : "text-slate-400")}>
                {fmtPnl(g.totalMtm)}
              </span>
              <span className="text-xs text-slate-600 ml-auto">{g.totalLots} lots</span>
            </button>

            {isExpanded && (
              <div className="bg-slate-800/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/40">
                      {["Trade Ref", `Total ${unitLabel}`, `Alloc ${unitLabel}`, `Unalloc ${unitLabel}`, "Entry $/bu", "Settle $/bu", "MTM", "Broker", ""].map(
                        (h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((h) => {
                      const isAlloc = allocTradeId === h.hedgeTradeId;
                      const isBreakdown = breakdownTradeId === h.hedgeTradeId;
                      const fullyAllocated = h.unallocatedLots === 0;
                      return (
                        <Fragment key={h.hedgeTradeId}>
                          <tr className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2 font-mono text-slate-200 text-xs">
                              <span className="inline-flex items-center">
                                {h.tradeRef}
                                {statusBadge(h)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-300">{fmtVol(h.bushels, "BU", unit)}</td>
                            <td className="px-4 py-2 text-slate-500">{fmtVol(h.allocatedBushels, "BU", unit)}</td>
                            <td className={cn("px-4 py-2 font-semibold", fullyAllocated ? "text-slate-500" : "text-emerald-400")}>{fmtVol(h.unallocatedBushels, "BU", unit)}</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{centsToUsd(h.entryPrice)}</td>
                            <td className="px-4 py-2 font-mono">
                              {h.settlePrice != null ? (
                                <span className="text-slate-200">{centsToUsd(h.settlePrice)}</span>
                              ) : (
                                <span className="text-slate-600 italic text-xs">no settle</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {h.mtmPnlUsd != null ? (
                                <span className={cn("flex items-center gap-1 font-semibold",
                                  h.mtmPnlUsd > 0 ? "text-emerald-400" : h.mtmPnlUsd < 0 ? "text-red-400" : "text-slate-400")}>
                                  {h.mtmPnlUsd > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : h.mtmPnlUsd < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  {fmtPnl(h.mtmPnlUsd)}
                                </span>
                              ) : <span className="text-slate-600 italic text-xs">&ndash;</span>}
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{h.brokerAccount}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                {h.allocatedLots > 0 && (
                                  <button
                                    onClick={() => { setBreakdownTradeId(isBreakdown ? null : h.hedgeTradeId); }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                                    title="View allocation breakdown"
                                  >
                                    {isBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                )}
                                {!fullyAllocated && (
                                  <button
                                    onClick={() => { setAllocTradeId(isAlloc ? null : h.hedgeTradeId); }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" /> Alloc
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isBreakdown && (
                            <tr className="border-t border-slate-800/50 bg-slate-800/10">
                              <td colSpan={9}>
                                <AllocationBreakdown tradeId={h.hedgeTradeId} />
                              </td>
                            </tr>
                          )}
                          {isAlloc && (
                            <tr className="border-t border-slate-800/50">
                              <td colSpan={9} className="px-4 py-2">
                                <AllocateForm hedge={h} sites={sites} onDone={handleDone} onCancel={() => setAllocTradeId(null)} />
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

// ─── Offsets Table ───────────────────────────────────────────────────────────

function OffsetsTable({ offsets, unit }: { offsets: OffsetItem[]; unit: Unit }) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Trade", "ZC", "Lots", unitLabel === "bu" ? "Bushels" : unitLabel, "Entry $/bu", "Exit $/bu", "P&L \u00a2/bu", "P&L $", "Site", "Date", "Notes"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offsets.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500 text-sm">No closed offsets</td></tr>
          )}
          {offsets.map((o) => {
            const pnlColor = o.pnlCentsBu > 0 ? "text-emerald-400" : o.pnlCentsBu < 0 ? "text-red-400" : "text-slate-400";
            return (
              <tr key={o.offsetId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-200 text-xs">{o.tradeRef}</td>
                <td className="px-4 py-3">
                  <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono">{o.futuresMonth}</span>
                </td>
                <td className="px-4 py-3 text-slate-300">{o.lots}</td>
                <td className="px-4 py-3 text-slate-300">{fmtVol(o.bushels, "BU", unit)}</td>
                <td className="px-4 py-3 text-slate-300 font-mono">{centsToUsd(o.entryPrice)}</td>
                <td className="px-4 py-3 text-slate-200 font-mono">{centsToUsd(o.exitPrice)}</td>
                <td className={cn("px-4 py-3 font-mono font-semibold", pnlColor)}>
                  {o.pnlCentsBu > 0 ? "+" : ""}{(o.pnlCentsBu / 100).toFixed(4)}
                </td>
                <td className={cn("px-4 py-3 font-semibold", pnlColor)}>{fmtPnl(o.pnlUsd)}</td>
                <td className="px-4 py-3">
                  {o.siteCode ? <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{o.siteCode}</span>
                    : <span className="text-slate-600 text-xs">Pool</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{o.offsetDate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{o.notes || "\u2013"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Month Allocations Table ────────────────────────────────────────────────

interface MonthGroup {
  budgetMonth: string;
  monthOnly: MonthAllocationItem[];
  siteAssigned: SiteAllocationItem[];
  totalLots: number;
  totalBu: number;
}

function MonthAllocationsTable({
  monthAllocations,
  siteAllocations,
  sites,
  settles,
  unit,
  onRefresh,
}: {
  monthAllocations: MonthAllocationItem[];
  siteAllocations: SiteAllocationItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  unit: Unit;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const unitLabel = unit === "MT" ? "MT" : "bu";
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignSite, setAssignSite] = useState("");
  const [saving, setSaving] = useState(false);

  const groups: MonthGroup[] = useMemo(() => {
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
    <div className="divide-y divide-slate-800">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">No allocations yet</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.budgetMonth;
        const unassignedCount = g.monthOnly.length;
        return (
          <Fragment key={g.budgetMonth}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.budgetMonth)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <span className="bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                {g.budgetMonth}
              </span>
              <span className="text-sm text-slate-300">{g.totalLots} lots</span>
              <span className="text-sm text-slate-500">{fmtVol(g.totalBu, "BU", unit)} {unitLabel}</span>
              {unassignedCount > 0 && (
                <span className="bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25 px-2 py-0.5 rounded text-xs font-medium">
                  {unassignedCount} unassigned
                </span>
              )}
              <span className="text-xs text-slate-600 ml-auto">
                {g.siteAssigned.length} site-assigned
              </span>
            </button>

            {isExpanded && (
              <div className="bg-slate-800/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/40">
                      {["Trade", "Dir", "Date", "ZC", "Lots", unitLabel, "Entry $/bu", "Site", ""].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Month-only allocations (no site) */}
                    {g.monthOnly.map((a) => {
                      const isAssigning = assigningId === a.allocationId;
                      return (
                        <Fragment key={`mo-${a.allocationId}`}>
                          <tr className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors bg-amber-500/5">
                            <td className="px-4 py-2 font-mono text-slate-200 text-xs">{a.tradeRef}</td>
                            <td className="px-4 py-2">
                              <span className={cn("px-2 py-0.5 rounded text-xs font-semibold",
                                a.side === "SHORT" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                              )}>{a.side || "LONG"}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs font-mono">{a.tradeDate}</td>
                            <td className="px-4 py-2">
                              <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-300">{a.allocatedLots}</td>
                            <td className="px-4 py-2 text-slate-300">{fmtVol(a.allocatedBushels, "BU", unit)}</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{centsToUsd(a.entryPrice)}</td>
                            <td className="px-4 py-2">
                              <span className="italic text-amber-400 text-xs">Unassigned</span>
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => { setAssigningId(isAssigning ? null : a.allocationId); setAssignSite(""); }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-lg text-xs font-medium transition-colors"
                              >
                                <MapPinPlus className="h-3 w-3" /> Assign Site
                              </button>
                            </td>
                          </tr>
                          {isAssigning && (
                            <tr className="border-t border-slate-800/50">
                              <td colSpan={9} className="px-4 py-3">
                                <div className="flex items-end gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs text-slate-500">Site</label>
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
                      <tr key={`sa-${a.allocationId}`} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2 font-mono text-slate-200 text-xs">{a.tradeRef}</td>
                        <td className="px-4 py-2">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold",
                            a.side === "SHORT" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                          )}>{a.side || "LONG"}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-xs font-mono">{a.tradeDate}</td>
                        <td className="px-4 py-2">
                          <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-300">{a.allocatedLots}</td>
                        <td className="px-4 py-2 text-slate-300">{fmtVol(a.allocatedBushels, "BU", unit)}</td>
                        <td className="px-4 py-2 text-slate-300 font-mono">{centsToUsd(a.entryPrice)}</td>
                        <td className="px-4 py-2">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span>
                        </td>
                        <td className="px-4 py-2" />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Book = "CANADA" | "US";
type View = "hedge-book" | "month-allocations";

export default function PositionsPage() {
  const [book, setBook] = useState<Book>("CANADA");
  const [view, setView] = useState<View>("hedge-book");
  const [unit, setUnit] = useState<Unit>("MT");
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const [settleOpen, setSettleOpen] = useState(false);

  const hedgeBook     = positions?.hedgeBook          ?? [];
  const allocations   = positions?.siteAllocations    ?? [];
  const monthAllocs   = positions?.monthAllocations   ?? [];
  const offsets       = positions?.offsets             ?? [];
  const settles       = positions?.latestSettles       ?? {};

  // Restore unit toggle from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pos-unit");
    if (saved === "BU" || saved === "MT") setUnit(saved);
  }, []);

  function toggleUnit() {
    setUnit((prev) => {
      const next = prev === "MT" ? "BU" : "MT";
      localStorage.setItem("pos-unit", next);
      return next;
    });
  }

  const unitLabel = unit === "MT" ? "MT" : "bu";

  // All unique futures months for settle publisher
  const allFuturesMonths = useMemo(() => {
    const months = new Set<string>();
    hedgeBook.forEach((h) => months.add(h.futuresMonth));
    allocations.forEach((a) => months.add(a.futuresMonth));
    return Array.from(months).sort();
  }, [hedgeBook, allocations]);

  // Portfolio MTM summary
  const portfolioMtm = useMemo(() => {
    return hedgeBook.reduce((s, h) => s + (h.mtmPnlUsd ?? 0), 0);
  }, [hedgeBook]);

  const bookLabel = book === "CANADA" ? "Canada" : "US";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Position Manager</h1>
        <SkeletonTable rows={3} cols={8} />
        <SkeletonTable rows={4} cols={8} />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={AlertCircle} title="Failed to load positions" description={error.message} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-400" />
          <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Position Manager</h1>
        </div>
        {view === "hedge-book" && (
          <button
            onClick={() => setSettleOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg font-medium border border-slate-700 transition-colors"
          >
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Publish Settle Prices
            {settleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* View tabs + Book toggle */}
      <div className="flex items-center gap-4">
        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {([
            { key: "hedge-book" as View, label: "Hedge Book" },
            { key: "month-allocations" as View, label: "Month Allocations" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                view === tab.key ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Book toggle */}
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => setBook(b)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                book === b ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
            </button>
          ))}
        </div>

        {/* Unit toggle */}
        <button
          onClick={toggleUnit}
          className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl"
        >
          {(["MT", "BU"] as Unit[]).map((u) => (
            <span
              key={u}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                unit === u ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {u === "MT" ? "Metric Tons" : "Bushels"}
            </span>
          ))}
        </button>
      </div>

      {/* ═══════════════════ HEDGE BOOK TAB ═══════════════════ */}
      {view === "hedge-book" && (
        <>
          {/* Settle publisher */}
          {settleOpen && (
            <SettlePublisher
              futuresMonths={allFuturesMonths.length > 0 ? allFuturesMonths : ["ZCH26", "ZCK26", "ZCN26"]}
              existingSettles={settles}
              onDone={() => { setSettleOpen(false); mutate(); }}
            />
          )}

          {/* Portfolio MTM Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Portfolio MTM &middot; {bookLabel}</p>
                <p className={cn("text-2xl font-bold tabular-nums",
                  portfolioMtm > 0 ? "text-emerald-400" : portfolioMtm < 0 ? "text-red-400" : "text-slate-300"
                )}>
                  {fmtPnl(portfolioMtm)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{hedgeBook.length} trades &middot; {fmtVol(hedgeBook.reduce((s, h) => s + h.bushels, 0), "BU", unit)} {unitLabel} total</p>
                <p className="text-xs text-slate-500">{fmtVol(hedgeBook.reduce((s, h) => s + h.unallocatedBushels, 0), "BU", unit)} {unitLabel} unallocated</p>
              </div>
            </div>
          </div>

          {/* Hedge Book table (ALL trades) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Hedge Book &middot; {bookLabel}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hedgeBook.length} trade{hedgeBook.length !== 1 ? "s" : ""} &middot; grouped by futures month
                </p>
              </div>
              <span className="text-xs text-slate-600">Click to expand. Includes fully allocated trades.</span>
            </div>
            <HedgeBookTable
              hedgeBook={hedgeBook}
              sites={sites}
              onRefresh={() => mutate()}
              unit={unit}
            />
          </div>

          {/* Closed Offsets */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-200">Closed Offsets</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {offsets.length} offset{offsets.length !== 1 ? "s" : ""}
                {offsets.length > 0 && (
                  <> &middot; Total P&L: <span className={cn("font-semibold",
                    offsets.reduce((s, o) => s + o.pnlUsd, 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtPnl(offsets.reduce((s, o) => s + o.pnlUsd, 0))}
                  </span></>
                )}
              </p>
            </div>
            <OffsetsTable offsets={offsets} unit={unit} />
          </div>
        </>
      )}

      {/* ═══════════════════ MONTH ALLOCATIONS TAB ═══════════════════ */}
      {view === "month-allocations" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">
              Month Allocations &middot; {bookLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hedge allocations grouped by budget month
            </p>
          </div>
          <MonthAllocationsTable
            monthAllocations={monthAllocs}
            siteAllocations={allocations}
            sites={sites}
            settles={settles}
            unit={unit}
            onRefresh={() => mutate()}
          />
        </div>
      )}
    </div>
  );
}
