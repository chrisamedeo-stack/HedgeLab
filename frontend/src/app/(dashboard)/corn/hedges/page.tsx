"use client";

import { useState, useMemo } from "react";
import { useHedgesByBook, useHedgeAllocations, useSites, HedgeTradeResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { Layers, Plus, X, ChevronDown, ChevronRight, Trash2, Edit2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  OPEN:          "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20",
  PARTIALLY_EFP: "text-amber-400  bg-amber-500/10  ring-1 ring-amber-500/20",
  FULLY_EFP:     "text-blue-400   bg-blue-500/10   ring-1 ring-blue-500/20",
  CLOSED:        "text-slate-400  bg-slate-500/10  ring-1 ring-slate-500/20",
};

const ZC_MONTHS = [
  "ZCH25","ZCK25","ZCN25","ZCU25","ZCZ25",
  "ZCH26","ZCK26","ZCN26","ZCU26","ZCZ26",
  "ZCH27","ZCK27","ZCN27","ZCU27","ZCZ27",
];

const BUSHELS_PER_LOT = 5_000;
const BUSHELS_PER_MT  = 39.3683;

// Generate budget month options covering the next 24 months
function generateBudgetMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = -2; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
const BUDGET_MONTHS = generateBudgetMonths();

// ─── Multi-line row type ──────────────────────────────────────────────────────

interface HedgeLineRow {
  key: number;
  futuresMonth: string;
  lots: string;
  pricePerBushel: string;
  notes: string;
}

let _rowKey = 1;
function makeRow(futuresMonth?: string): HedgeLineRow {
  return { key: _rowKey++, futuresMonth: futuresMonth ?? ZC_MONTHS[5], lots: "", pricePerBushel: "", notes: "" };
}

// ─── Allocation Panel ─────────────────────────────────────────────────────────

function AllocationPanel({
  trade,
  onClose,
  onChanged,
}: {
  trade: HedgeTradeResponse;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { allocations, isLoading, mutate } = useHedgeAllocations(trade.id);
  const { sites } = useSites();
  const { toast } = useToast();

  // Step 1: Allocate to month
  const [monthForm, setMonthForm] = useState({ budgetMonth: BUDGET_MONTHS[2], allocatedLots: "" });
  const [submitting, setSubmitting] = useState(false);

  // Step 2: Assign to site
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState({ siteCode: "", lots: "" });

  // Split allocations into month-only vs site-assigned
  const monthAllocations = useMemo(() => allocations.filter((a) => a.siteCode === null), [allocations]);
  const siteAllocations = useMemo(() => allocations.filter((a) => a.siteCode !== null), [allocations]);

  // Group site allocations by budgetMonth for display under their parent month row
  const siteAllocsByMonth = useMemo(() => {
    const map: Record<string, typeof siteAllocations> = {};
    for (const a of siteAllocations) {
      (map[a.budgetMonth] ??= []).push(a);
    }
    return map;
  }, [siteAllocations]);

  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedLots, 0);
  const totalMonthAllocated = monthAllocations.reduce((s, a) => s + a.allocatedLots, 0) +
    siteAllocations.reduce((s, a) => s + a.allocatedLots, 0);
  const remaining = trade.lots - totalAllocated;

  // Step 1 handler: allocate to month
  async function handleMonthAllocate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/api/v1/corn/hedges/${trade.id}/allocations`, {
        siteCode: null,
        budgetMonth: monthForm.budgetMonth,
        allocatedLots: parseInt(monthForm.allocatedLots),
      });
      toast("Lots allocated to month", "success");
      setMonthForm((f) => ({ ...f, allocatedLots: "" }));
      mutate();
      onChanged();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Allocation failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Step 2 handler: assign site to month allocation
  async function handleAssignSite(monthAllocId: number) {
    if (!assignForm.siteCode) { toast("Select a site", "error"); return; }
    setSubmitting(true);
    try {
      await api.post(`/api/v1/corn/hedges/allocations/${monthAllocId}/assign-site`, {
        siteCode: assignForm.siteCode,
        lots: parseInt(assignForm.lots),
      });
      toast("Site assigned", "success");
      setAssigningId(null);
      setAssignForm({ siteCode: "", lots: "" });
      mutate();
      onChanged();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Assignment failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/api/v1/corn/hedges/allocations/${id}`);
      toast("Allocation removed", "success");
      mutate();
      onChanged();
    } catch {
      toast("Failed to remove allocation", "error");
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">
            Allocate <span className="text-blue-400">{trade.tradeRef}</span> — {trade.futuresMonth}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {trade.lots} total lots · {totalMonthAllocated} to months · <span className={remaining === 0 ? "text-amber-400" : "text-emerald-400"}>{remaining} unallocated</span>
          </p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${Math.min((totalMonthAllocated / trade.lots) * 100, 100)}%` }}
        />
      </div>

      {/* Month Allocations Table */}
      {isLoading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : (monthAllocations.length > 0 || siteAllocations.length > 0) ? (
        <div className="space-y-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Month Allocations</p>
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Month</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Lots</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">MT</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Site Assignments</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {/* Collect all unique budget months from both month-only and site allocs */}
                {(() => {
                  const allMonths = new Set([
                    ...monthAllocations.map((a) => a.budgetMonth),
                    ...siteAllocations.map((a) => a.budgetMonth),
                  ]);
                  const sortedMonths = Array.from(allMonths).sort();
                  return sortedMonths.map((month) => {
                    const monthAlloc = monthAllocations.find((a) => a.budgetMonth === month);
                    const monthSiteAllocs = siteAllocsByMonth[month] ?? [];
                    const totalMonthLots = (monthAlloc?.allocatedLots ?? 0) + monthSiteAllocs.reduce((s, a) => s + a.allocatedLots, 0);
                    const totalMonthMt = totalMonthLots * BUSHELS_PER_LOT / BUSHELS_PER_MT;
                    const unassignedLots = monthAlloc?.allocatedLots ?? 0;
                    const isAssigning = assigningId === monthAlloc?.id;

                    return (
                      <tr key={month} className="align-top">
                        <td className="px-3 py-2 text-slate-300 font-mono">{month}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-200">{totalMonthLots}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-400">{totalMonthMt.toFixed(0)}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            {/* Site assignments for this month */}
                            {monthSiteAllocs.map((sa) => (
                              <div key={sa.id} className="flex items-center gap-2 text-slate-300">
                                <span>{sa.siteName}: {sa.allocatedLots} lots</span>
                                <button
                                  onClick={() => handleDelete(sa.id)}
                                  className="text-slate-600 hover:text-red-400 transition-colors"
                                  title="Remove site assignment"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            {/* Unassigned lots */}
                            {unassignedLots > 0 && (
                              <>
                                <button
                                  onClick={() => {
                                    if (isAssigning) {
                                      setAssigningId(null);
                                    } else {
                                      setAssigningId(monthAlloc!.id);
                                      setAssignForm({ siteCode: sites[0]?.code ?? "", lots: String(unassignedLots) });
                                    }
                                  }}
                                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                  <ChevronRight className={cn("h-3 w-3 transition-transform", isAssigning && "rotate-90")} />
                                  {unassignedLots} lots unassigned
                                </button>
                                {/* Inline assign-to-site form */}
                                {isAssigning && (
                                  <div className="flex items-end gap-2 mt-1 p-2 bg-slate-900/60 rounded-lg border border-slate-700/50">
                                    <div className="space-y-1">
                                      <label className="text-xs text-slate-500">Site</label>
                                      <select
                                        className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={assignForm.siteCode}
                                        onChange={(e) => setAssignForm((f) => ({ ...f, siteCode: e.target.value }))}
                                      >
                                        <option value="">— Select —</option>
                                        {sites.map((s) => (
                                          <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-slate-500">Lots (max {unassignedLots})</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max={unassignedLots}
                                        className="w-20 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={assignForm.lots}
                                        onChange={(e) => setAssignForm((f) => ({ ...f, lots: e.target.value }))}
                                      />
                                    </div>
                                    <button
                                      onClick={() => handleAssignSite(monthAlloc!.id)}
                                      disabled={submitting}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                      {submitting ? "…" : "Assign"}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            {/* Month has only site allocs, no unassigned */}
                            {unassignedLots === 0 && monthSiteAllocs.length > 0 && (
                              <span className="text-emerald-500 text-xs">Fully assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {monthAlloc && (
                            <button
                              onClick={() => handleDelete(monthAlloc.id)}
                              className="text-slate-600 hover:text-red-400 transition-colors"
                              title="Remove month allocation"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No allocations yet</p>
      )}

      {/* Step 1: Allocate to Month form */}
      {remaining > 0 && (
        <form onSubmit={handleMonthAllocate} className="p-3 bg-slate-900/40 border border-slate-700/50 rounded-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 1 — Allocate to Month</p>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Budget Month</label>
              <select
                className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={monthForm.budgetMonth}
                onChange={(e) => setMonthForm((f) => ({ ...f, budgetMonth: e.target.value }))}
              >
                {BUDGET_MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Lots (max {remaining})</label>
              <input
                type="number"
                min="1"
                max={remaining}
                className="w-24 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                placeholder="e.g. 10"
                value={monthForm.allocatedLots}
                onChange={(e) => setMonthForm((f) => ({ ...f, allocatedLots: e.target.value }))}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {submitting ? "Allocating…" : "Allocate"}
            </button>
          </div>
        </form>
      )}
      {remaining === 0 && (
        <p className="text-xs text-amber-400">All lots are allocated to months.</p>
      )}
    </div>
  );
}

// ─── Hedge Table ──────────────────────────────────────────────────────────────

function HedgeTable({ book, showForm, setShowForm }: { book: "CANADA" | "US"; showForm: boolean; setShowForm: (v: boolean) => void }) {
  const { hedges, isLoading, mutate } = useHedgesByBook(book);
  const { toast } = useToast();
  const [submitting, setSubmitting]     = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [editing, setEditing]           = useState<HedgeTradeResponse | null>(null);

  // ─── Shared fields (top of ticket) ────────────────────────────────────────
  const [shared, setShared] = useState({
    brokerAccount: "StoneX",
    tradeDate: new Date().toISOString().slice(0, 10),
  });

  // ─── Multi-line rows ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<HedgeLineRow[]>(() => [makeRow()]);

  // ─── Single-edit form (legacy fields for editing one trade) ───────────────
  const [editForm, setEditForm] = useState({
    futuresMonth: ZC_MONTHS[5],
    lots: "",
    pricePerBushel: "",
    brokerAccount: "StoneX",
    tradeDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  function startEdit(h: HedgeTradeResponse) {
    setEditing(h);
    setEditForm({
      futuresMonth: h.futuresMonth,
      lots: String(h.lots),
      pricePerBushel: String((h.pricePerBushel / 100).toFixed(4)),
      brokerAccount: h.brokerAccount ?? "StoneX",
      tradeDate: h.tradeDate,
      notes: h.notes ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setRows([makeRow()]);
    setShared({ brokerAccount: "StoneX", tradeDate: new Date().toISOString().slice(0, 10) });
  }

  // ─── Row helpers ──────────────────────────────────────────────────────────
  function updateRow(key: number, field: keyof HedgeLineRow, value: string) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }
  function removeRow(key: number) {
    setRows((prev) => prev.length <= 1 ? prev : prev.filter((r) => r.key !== key));
  }
  function addRow() {
    // Default the new row's futures month to the next ZC month after the last row
    const lastMonth = rows[rows.length - 1]?.futuresMonth;
    const lastIdx = ZC_MONTHS.indexOf(lastMonth);
    const nextMonth = lastIdx >= 0 && lastIdx + 1 < ZC_MONTHS.length ? ZC_MONTHS[lastIdx + 1] : undefined;
    setRows((prev) => [...prev, makeRow(nextMonth)]);
  }
  function applyPriceToAll() {
    const firstPrice = rows[0]?.pricePerBushel;
    if (!firstPrice) return;
    setRows((prev) => prev.map((r) => ({ ...r, pricePerBushel: firstPrice })));
  }
  function applyLotsToAll() {
    const firstLots = rows[0]?.lots;
    if (!firstLots) return;
    setRows((prev) => prev.map((r) => ({ ...r, lots: firstLots })));
  }

  // ─── Summary calculations ─────────────────────────────────────────────────
  const filledRows = rows.filter((r) => (parseInt(r.lots) || 0) > 0 && (parseFloat(r.pricePerBushel) || 0) > 0);
  const totals = useMemo(() => {
    let totalLots = 0, totalBu = 0, totalNotional = 0;
    for (const r of rows) {
      const lots = parseInt(r.lots) || 0;
      const price = parseFloat(r.pricePerBushel) || 0;
      const bu = lots * BUSHELS_PER_LOT;
      totalLots += lots;
      totalBu += bu;
      totalNotional += bu * price;
    }
    return { totalLots, totalBu, totalMt: totalBu / BUSHELS_PER_MT, totalNotional };
  }, [rows]);

  // ─── Single-edit calculations ─────────────────────────────────────────────
  const editLots = parseInt(editForm.lots) || 0;
  const editBu = editLots * BUSHELS_PER_LOT;
  const editMt = editBu / BUSHELS_PER_MT;
  const editPrice = parseFloat(editForm.pricePerBushel) || 0;
  const editNotional = editBu * editPrice;

  // Rows with lots but missing price (validation hint)
  const incompletRows = rows.filter((r) => (parseInt(r.lots) || 0) > 0 && !(parseFloat(r.pricePerBushel) > 0));

  // ─── Submit: bulk create ──────────────────────────────────────────────────
  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (incompletRows.length > 0) { toast("Enter a price for every row with lots", "error"); return; }
    if (filledRows.length === 0) { toast("Add lots and price to at least one row", "error"); return; }
    setSubmitting(true);
    try {
      const payloads = filledRows.map((r) => ({
        futuresMonth: r.futuresMonth,
        lots: parseInt(r.lots),
        pricePerBushel: parseFloat(r.pricePerBushel) * 100,
        brokerAccount: shared.brokerAccount,
        tradeDate: shared.tradeDate,
        book,
        notes: r.notes || null,
      }));
      if (payloads.length === 1) {
        await api.post("/api/v1/corn/hedges", payloads[0]);
      } else {
        await api.post("/api/v1/corn/hedges/bulk", payloads);
      }
      toast(`${payloads.length} hedge trade${payloads.length !== 1 ? "s" : ""} booked`, "success");
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Submit: single edit ──────────────────────────────────────────────────
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await api.put(`/api/v1/corn/hedges/${editing.id}`, {
        futuresMonth: editForm.futuresMonth,
        lots: parseInt(editForm.lots),
        pricePerBushel: parseFloat(editForm.pricePerBushel) * 100,
        brokerAccount: editForm.brokerAccount,
        tradeDate: editForm.tradeDate,
        book,
        notes: editForm.notes || null,
      });
      toast("Hedge trade updated", "success");
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(h: HedgeTradeResponse) {
    try {
      await api.delete(`/api/v1/corn/hedges/${h.id}`);
      toast("Hedge trade deleted", "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Delete failed", "error");
    }
  }

  const kpiTotalLots   = hedges.reduce((s, h) => s + (h.lots ?? 0), 0);
  const kpiOpenLots    = hedges.reduce((s, h) => s + (h.openLots ?? 0), 0);
  const kpiAllocated   = hedges.reduce((s, h) => s + (h.allocatedLots ?? 0), 0);
  const kpiUnallocated = hedges.reduce((s, h) => s + (h.unallocatedLots ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Lots",  value: formatNumber(kpiTotalLots) },
          { label: "Open Lots",   value: formatNumber(kpiOpenLots) },
          { label: "Allocated",   value: formatNumber(kpiAllocated) },
          { label: "Unallocated", value: formatNumber(kpiUnallocated), warn: kpiUnallocated > 0 },
        ].map(({ label, value, warn }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums", warn ? "text-amber-400" : "text-slate-100")}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Unallocated warning */}
      {kpiUnallocated > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <GitBranch className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{formatNumber(kpiUnallocated)} lots</span> are unallocated — expand a trade below to assign them to a budget month.
          </p>
        </div>
      )}

      {/* ─── Create / Edit form ──────────────────────────────────────────── */}
      {showForm && !editing && (
        <form onSubmit={handleBulkSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Book Hedge Trade{rows.length > 1 ? "s" : ""} — <span className="text-blue-400">{book} Book</span>
            </h2>
            <button type="button" onClick={cancelForm} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Broker Account</label>
              <input type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                value={shared.brokerAccount}
                onChange={(e) => setShared((s) => ({ ...s, brokerAccount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Trade Date</label>
              <input type="date"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={shared.tradeDate}
                onChange={(e) => setShared((s) => ({ ...s, tradeDate: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Multi-line grid */}
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-700">
                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Futures Month</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">
                    <span>Lots</span>
                    {rows.length > 1 && rows[0]?.lots && (
                      <button type="button" onClick={applyLotsToAll}
                        className="ml-2 text-blue-400 hover:text-blue-300 transition-colors font-normal normal-case tracking-normal">
                        apply all
                      </button>
                    )}
                  </th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-32">Bushels</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">MT</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-32">
                    <span>Price ($/bu)</span>
                    {rows.length > 1 && rows[0]?.pricePerBushel && (
                      <button type="button" onClick={applyPriceToAll}
                        className="ml-2 text-blue-400 hover:text-blue-300 transition-colors font-normal normal-case tracking-normal">
                        apply all
                      </button>
                    )}
                  </th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-32">Notional</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Notes</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r) => {
                  const lots = parseInt(r.lots) || 0;
                  const bu = lots * BUSHELS_PER_LOT;
                  const mt = bu / BUSHELS_PER_MT;
                  const price = parseFloat(r.pricePerBushel) || 0;
                  const notional = bu * price;
                  const incomplete = lots > 0 && price === 0;
                  return (
                    <tr key={r.key} className={cn("hover:bg-slate-800/30", incomplete && "bg-red-500/5")}>
                      <td className="px-3 py-1.5">
                        <select value={r.futuresMonth} onChange={(e) => updateRow(r.key, "futuresMonth", e.target.value)}
                          className="w-full bg-transparent text-slate-200 focus:outline-none text-sm">
                          {ZC_MONTHS.map((m) => <option key={m} className="bg-slate-800">{m}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min="1" placeholder="e.g. 40" value={r.lots}
                          onChange={(e) => updateRow(r.key, "lots", e.target.value)}
                          className="w-full bg-transparent text-slate-200 text-right tabular-nums placeholder:text-slate-700 focus:outline-none" />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 text-xs">
                        {bu > 0 ? formatNumber(bu) : "\u2014"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 text-xs">
                        {mt > 0 ? formatNumber(Math.round(mt)) : "\u2014"}
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" step="0.0025" placeholder="e.g. 4.39" value={r.pricePerBushel}
                          onChange={(e) => updateRow(r.key, "pricePerBushel", e.target.value)}
                          className="w-full bg-transparent text-slate-200 text-right tabular-nums placeholder:text-slate-700 focus:outline-none" />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                        {notional > 0
                          ? <span className="text-emerald-400">${formatNumber(Math.round(notional))}</span>
                          : <span className="text-slate-700">&mdash;</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="text" placeholder="Optional" value={r.notes}
                          onChange={(e) => updateRow(r.key, "notes", e.target.value)}
                          className="w-full bg-transparent text-slate-500 placeholder:text-slate-700 focus:outline-none text-xs" />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {rows.length > 1 && (
                          <button type="button" onClick={() => removeRow(r.key)}
                            className="text-slate-600 hover:text-red-400 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              {rows.length > 1 && totals.totalLots > 0 && (
                <tfoot>
                  <tr className="bg-slate-800/50 border-t border-slate-700">
                    <td className="px-3 py-2 text-xs text-slate-500 font-medium">
                      {filledRows.length} trade{filledRows.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-200 text-sm">
                      {formatNumber(totals.totalLots)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400 text-xs">
                      {formatNumber(totals.totalBu)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400 text-xs">
                      {formatNumber(Math.round(totals.totalMt))}
                    </td>
                    <td />
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-400 text-xs font-medium">
                      {totals.totalNotional > 0 ? `$${formatNumber(Math.round(totals.totalNotional))}` : ""}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Add row button */}
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add another month
          </button>

          {/* Single-row summary (when only 1 row, show the familiar summary bar) */}
          {rows.length === 1 && totals.totalLots > 0 && (
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Bushels</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(totals.totalBu)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">MT Equiv.</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(Math.round(totals.totalMt))} MT</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Notional (USD)</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">
                  {totals.totalNotional > 0 ? `$${formatNumber(Math.round(totals.totalNotional))}` : "\u2014"}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting || filledRows.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {submitting ? "Saving\u2026" : `Book ${filledRows.length} Hedge${filledRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      )}

      {/* ─── Edit form (single trade) ────────────────────────────────────── */}
      {showForm && editing && (
        <form onSubmit={handleEditSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Edit <span className="text-blue-400">{editing.tradeRef}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Futures Month</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editForm.futuresMonth}
                onChange={(e) => setEditForm((f) => ({ ...f, futuresMonth: e.target.value }))}
                required
              >
                {ZC_MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Lots (5,000 bu each)</label>
              <input
                type="number" min="1"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. 40"
                value={editForm.lots}
                onChange={(e) => setEditForm((f) => ({ ...f, lots: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Price ($/bu)</label>
              <input
                type="number" step="0.0025"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. 4.39"
                value={editForm.pricePerBushel}
                onChange={(e) => setEditForm((f) => ({ ...f, pricePerBushel: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Broker Account</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                value={editForm.brokerAccount}
                onChange={(e) => setEditForm((f) => ({ ...f, brokerAccount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Trade Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editForm.tradeDate}
                onChange={(e) => setEditForm((f) => ({ ...f, tradeDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Notes</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="Optional"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          {editLots > 0 && (
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Bushels</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(editBu)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">MT Equiv.</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(Math.round(editMt))} MT</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Notional (USD)</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">
                  {editNotional > 0 ? `$${formatNumber(Math.round(editNotional))}` : "\u2014"}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {submitting ? "Saving\u2026" : "Update Hedge"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} cols={8} />
        ) : hedges.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No hedge trades"
            description={`Book a CBOT ZC futures position for the ${book} book to start hedging corn exposure.`}
            action={{ label: "Book Hedge", onClick: () => setShowForm(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th className="w-8" />
                {["Ref", "Month", "Lots", "Open", "Allocated", "Unalloc.", "Price ($/bu)", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {hedges.map((h) => (
                <>
                  <tr
                    key={h.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                  >
                    <td className="px-2 py-3 text-center text-slate-500">
                      {expandedId === h.id
                        ? <ChevronDown className="h-3.5 w-3.5 inline" />
                        : <ChevronRight className="h-3.5 w-3.5 inline" />}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-blue-400">{h.tradeRef}</td>
                    <td className="px-3 py-3 text-slate-300">{h.futuresMonth}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-200">{h.lots}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-400">{h.openLots}</td>
                    <td className="px-3 py-3 tabular-nums text-emerald-400">{h.allocatedLots ?? 0}</td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className={h.unallocatedLots > 0 ? "text-amber-400" : "text-slate-500"}>
                        {h.unallocatedLots ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-200">{h.pricePerBushel != null ? (h.pricePerBushel / 100).toFixed(4) : "\u2014"}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[h.status] ?? "text-slate-400"
                      )}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => startEdit(h)} className="text-slate-600 hover:text-blue-400 transition-colors" title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(h)} className="text-slate-600 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === h.id && (
                    <tr key={`${h.id}-alloc`}>
                      <td colSpan={10} className="px-4 py-3 bg-slate-950/40">
                        <AllocationPanel
                          trade={h}
                          onClose={() => setExpandedId(null)}
                          onChanged={mutate}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Book = "CANADA" | "US";

export default function HedgesPage() {
  const [book, setBook] = useState<Book>("CANADA");
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Hedge Books</h1>
          <p className="text-sm text-slate-400 mt-0.5">CBOT ZC corn futures · allocate lots to sites and budget months</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Book Hedge"}
        </button>
      </div>

      {/* Book tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        {(["CANADA", "US"] as Book[]).map((b) => (
          <button
            key={b}
            onClick={() => { setBook(b); setShowForm(false); }}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              book === b
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
          </button>
        ))}
      </div>

      <HedgeTable key={book} book={book} showForm={showForm} setShowForm={setShowForm} />
    </div>
  );
}
