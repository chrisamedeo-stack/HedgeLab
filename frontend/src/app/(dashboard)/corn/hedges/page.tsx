"use client";

import { useState } from "react";
import { useHedgesByBook, useHedgeAllocations, useSites, HedgeTradeResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { Layers, Plus, X, ChevronDown, ChevronRight, Trash2, GitBranch } from "lucide-react";
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
  const [form, setForm] = useState({ siteCode: "", budgetMonth: BUDGET_MONTHS[2], allocatedLots: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedLots, 0);
  const remaining = trade.lots - totalAllocated;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.siteCode) { toast("Select a site", "error"); return; }
    setSubmitting(true);
    try {
      await api.post(`/api/v1/corn/hedges/${trade.id}/allocations`, {
        siteCode: form.siteCode,
        budgetMonth: form.budgetMonth,
        allocatedLots: parseInt(form.allocatedLots),
        notes: form.notes || null,
      });
      toast("Lots allocated", "success");
      setForm((f) => ({ ...f, allocatedLots: "", notes: "" }));
      mutate();
      onChanged();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Allocation failed", "error");
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
            {trade.lots} total lots · {totalAllocated} allocated · <span className={remaining === 0 ? "text-amber-400" : "text-emerald-400"}>{remaining} remaining</span>
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
          style={{ width: `${Math.min((totalAllocated / trade.lots) * 100, 100)}%` }}
        />
      </div>

      {/* Existing allocations */}
      {isLoading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : allocations.length > 0 ? (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700">
                <th className="px-3 py-2 text-left text-slate-400 font-medium">Site</th>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">Budget Month</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">Lots</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">MT</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {allocations.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-300">{a.siteName} <span className="text-slate-500">({a.siteCode})</span></td>
                  <td className="px-3 py-2 text-slate-400">{a.budgetMonth}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-200">{a.allocatedLots}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{a.allocatedMt.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Remove allocation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No allocations yet</p>
      )}

      {/* Add allocation form */}
      {remaining > 0 && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Site</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.siteCode}
              onChange={(e) => setForm((f) => ({ ...f, siteCode: e.target.value }))}
              required
            >
              <option value="">— Select —</option>
              {sites.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Budget Month</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.budgetMonth}
              onChange={(e) => setForm((f) => ({ ...f, budgetMonth: e.target.value }))}
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
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
              placeholder="e.g. 10"
              value={form.allocatedLots}
              onChange={(e) => setForm((f) => ({ ...f, allocatedLots: e.target.value }))}
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
        </form>
      )}
      {remaining === 0 && (
        <p className="text-xs text-amber-400">All lots are allocated.</p>
      )}
    </div>
  );
}

// ─── Hedge Table ──────────────────────────────────────────────────────────────

function HedgeTable({ book }: { book: "CANADA" | "US" }) {
  const { hedges, isLoading, mutate } = useHedgesByBook(book);
  const { toast } = useToast();
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const [form, setForm] = useState({
    futuresMonth: ZC_MONTHS[5], // ZCN26 default
    lots: "",
    pricePerBushel: "",
    brokerAccount: "StoneX",
    tradeDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const lots        = parseInt(form.lots) || 0;
  const bushels     = lots * BUSHELS_PER_LOT;
  const equivMt     = bushels / BUSHELS_PER_MT;
  const pricePerBu  = parseFloat(form.pricePerBushel) || 0;
  const notionalUsd = (bushels * pricePerBu) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/hedges", {
        futuresMonth:  form.futuresMonth,
        lots:          parseInt(form.lots),
        pricePerBushel: parseFloat(form.pricePerBushel),
        brokerAccount: form.brokerAccount,
        tradeDate:     form.tradeDate,
        book,
        notes:         form.notes || null,
      });
      toast("Hedge trade booked", "success");
      setShowForm(false);
      setForm((f) => ({ ...f, lots: "", pricePerBushel: "", notes: "" }));
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Booking failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalLots    = hedges.reduce((s, h) => s + (h.lots ?? 0), 0);
  const openLots     = hedges.reduce((s, h) => s + (h.openLots ?? 0), 0);
  const allocatedLots= hedges.reduce((s, h) => s + (h.allocatedLots ?? 0), 0);
  const unallocated  = hedges.reduce((s, h) => s + (h.unallocatedLots ?? 0), 0);
  const totalMt      = hedges.reduce((s, h) => s + (h.equivalentMt ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Lots",      value: formatNumber(totalLots) },
          { label: "Open Lots",       value: formatNumber(openLots) },
          { label: "Allocated",       value: formatNumber(allocatedLots) },
          { label: "Unallocated",     value: formatNumber(unallocated), warn: unallocated > 0 },
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
      {unallocated > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <GitBranch className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{formatNumber(unallocated)} lots</span> are unallocated — expand a trade below to assign them to a site and budget month.
          </p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Book Hedge Trade — <span className="text-blue-400">{book} Book</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Futures Month</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.futuresMonth}
                onChange={(e) => field("futuresMonth", e.target.value)}
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
                value={form.lots}
                onChange={(e) => field("lots", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Price (¢/bu)</label>
              <input
                type="number" step="0.25"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. 438.75"
                value={form.pricePerBushel}
                onChange={(e) => field("pricePerBushel", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Broker Account</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                value={form.brokerAccount}
                onChange={(e) => field("brokerAccount", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Trade Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.tradeDate}
                onChange={(e) => field("tradeDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Notes</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </div>
          </div>

          {lots > 0 && (
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Bushels</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(bushels)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">MT Equiv.</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(Math.round(equivMt))} MT</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Notional (USD)</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">
                  {notionalUsd > 0 ? `$${formatNumber(Math.round(notionalUsd))}` : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {submitting ? "Booking…" : "Book Hedge"}
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
                {["Ref", "Month", "Lots", "Open", "Allocated", "Unalloc.", "Price (¢/bu)", "Status"].map((h) => (
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
                    <td className="px-3 py-3 tabular-nums text-slate-200">{h.pricePerBushel?.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[h.status] ?? "text-slate-400"
                      )}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === h.id && (
                    <tr key={`${h.id}-alloc`}>
                      <td colSpan={9} className="px-4 py-3 bg-slate-950/40">
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
          <h1 className="text-xl font-semibold text-slate-100">Hedge Books</h1>
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
            {b === "CANADA" ? "🇨🇦 Canada" : "🇺🇸 United States"}
          </button>
        ))}
      </div>

      <HedgeTable key={book} book={book} />
    </div>
  );
}
