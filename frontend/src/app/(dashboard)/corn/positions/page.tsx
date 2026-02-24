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
  Trash2,
  Edit2,
} from "lucide-react";
import {
  usePositions,
  useSites,
  useHedgesByBook,
  useHedgeAllocations,
  HedgeBookItem,
  HedgeTradeResponse,
  SiteAllocationItem,
  MonthAllocationItem,
} from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
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
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MtmPnlChart } from "./_components/mtm-pnl-chart";
import { ExportButton } from "@/components/ui/ExportButton";
import { toCsv, downloadCsv } from "@/lib/csv-export";

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

// ─── Book Hedge Constants ────────────────────────────────────────────────────

const ZC_MONTHS = [
  "ZCH25","ZCK25","ZCN25","ZCU25","ZCZ25",
  "ZCH26","ZCK26","ZCN26","ZCU26","ZCZ26",
  "ZCH27","ZCK27","ZCN27","ZCU27","ZCZ27",
];

const BUSHELS_PER_LOT = 5_000;

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

// ─── Book Hedge Form ─────────────────────────────────────────────────────────

function BookHedgeForm({
  book,
  editing,
  onDone,
  onCancel,
}: {
  book: "CANADA" | "US";
  editing: HedgeTradeResponse | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // ─── Shared fields ──────────────────────────────────────────────────────
  const [shared, setShared] = useState({
    brokerAccount: "StoneX",
    tradeDate: new Date().toISOString().slice(0, 10),
  });

  // ─── Multi-line rows ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<HedgeLineRow[]>(() => [makeRow()]);

  // ─── Single-edit form ─────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    futuresMonth: ZC_MONTHS[5],
    lots: "",
    pricePerBushel: "",
    brokerAccount: "StoneX",
    tradeDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Initialize edit form when editing changes
  useEffect(() => {
    if (editing) {
      setEditForm({
        futuresMonth: editing.futuresMonth,
        lots: String(editing.lots),
        pricePerBushel: String((editing.pricePerBushel / 100).toFixed(4)),
        brokerAccount: editing.brokerAccount ?? "StoneX",
        tradeDate: editing.tradeDate,
        notes: editing.notes ?? "",
      });
    }
  }, [editing]);

  // ─── Row helpers ──────────────────────────────────────────────────────────
  function updateRow(key: number, field: keyof HedgeLineRow, value: string) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }
  function removeRow(key: number) {
    setRows((prev) => prev.length <= 1 ? prev : prev.filter((r) => r.key !== key));
  }
  function addRow() {
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
    return { totalLots, totalBu, totalNotional };
  }, [rows]);

  const editLots = parseInt(editForm.lots) || 0;
  const editBu = editLots * BUSHELS_PER_LOT;
  const editNotional = editBu * (parseFloat(editForm.pricePerBushel) || 0);

  const incompletRows = rows.filter((r) => (parseInt(r.lots) || 0) > 0 && !(parseFloat(r.pricePerBushel) > 0));

  // ─── Submit: bulk create ──────────────────────────────────────────────────
  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (incompletRows.length > 0) { toast.toast("Enter a price for every row with lots", "error"); return; }
    if (filledRows.length === 0) { toast.toast("Add lots and price to at least one row", "error"); return; }
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
      toast.toast(`${payloads.length} hedge trade${payloads.length !== 1 ? "s" : ""} booked`, "success");
      onDone();
    } catch (err: unknown) {
      toast.toast((err as Error).message ?? "Save failed", "error");
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
      toast.toast("Hedge trade updated", "success");
      onDone();
    } catch (err: unknown) {
      toast.toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Create form (multi-line) ─────────────────────────────────────────────
  if (!editing) {
    return (
      <form onSubmit={handleBulkSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            Book Hedge Trade{rows.length > 1 ? "s" : ""} — <span className="text-blue-400">{book} Book</span>
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
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

        {/* Single-row summary */}
        {rows.length === 1 && totals.totalLots > 0 && (
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-xs text-slate-500">Bushels</p>
              <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(totals.totalBu)}</p>
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
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting || filledRows.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {submitting ? "Saving\u2026" : `Book ${filledRows.length} Hedge${filledRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    );
  }

  // ─── Edit form (single trade) ─────────────────────────────────────────────
  return (
    <form onSubmit={handleEditSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          Edit <span className="text-blue-400">{editing.tradeRef}</span>
        </h2>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
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
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/50 rounded-lg">
          <div>
            <p className="text-xs text-slate-500">Bushels</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(editBu)}</p>
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
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving\u2026" : "Update Hedge"}
        </button>
      </div>
    </form>
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
  onEdit,
  onDelete,
}: {
  hedgeBook: HedgeBookItem[];
  sites: { code: string; name: string }[];
  onRefresh: () => void;
  onEdit: (tradeId: number) => void;
  onDelete: (tradeId: number) => void;
}) {
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
              <span className="text-sm text-slate-300">{fmtVol(g.totalBu)} bu</span>
              <span className="text-sm text-slate-500">{fmtVol(g.unallocBu)} unalloc</span>
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
                      {["Trade Ref", "Total bu", "Alloc bu", "Unalloc bu", "Entry $/bu", "Settle $/bu", "MTM", "Broker", ""].map(
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
                            <td className="px-4 py-2 text-slate-300">{fmtVol(h.bushels)}</td>
                            <td className="px-4 py-2 text-slate-500">{fmtVol(h.allocatedBushels)}</td>
                            <td className={cn("px-4 py-2 font-semibold", fullyAllocated ? "text-slate-500" : "text-emerald-400")}>{fmtVol(h.unallocatedBushels)}</td>
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
                                <button
                                  onClick={() => onEdit(h.hedgeTradeId)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                                  title="Edit trade"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => onDelete(h.hedgeTradeId)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 hover:bg-red-600/30 text-slate-300 hover:text-red-300 rounded-lg text-xs font-medium transition-colors"
                                  title="Delete trade"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
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
  onRefresh,
}: {
  monthAllocations: MonthAllocationItem[];
  siteAllocations: SiteAllocationItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  onRefresh: () => void;
}) {
  const toast = useToast();
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
              <span className="text-sm text-slate-500">{fmtVol(g.totalBu)} bu</span>
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
                      {["Trade", "Dir", "Date", "ZC", "Lots", "Bushels", "Entry $/bu", "Site", ""].map((h) => (
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
                            <td className="px-4 py-2 text-slate-300">{fmtVol(a.allocatedBushels)}</td>
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
                        <td className="px-4 py-2 text-slate-300">{fmtVol(a.allocatedBushels)}</td>
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
type View = "hedge-book" | "allocations";

export default function PositionsPage() {
  const [book, setBook] = useState<Book>("CANADA");
  const [view, setView] = useState<View>("hedge-book");
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const { hedges, mutate: hedgesMutate } = useHedgesByBook(book);
  const toast = useToast();
  const [settleOpen, setSettleOpen] = useState(false);
  const [hedgeFormOpen, setHedgeFormOpen] = useState(false);
  const [editing, setEditing] = useState<HedgeTradeResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const hedgeBook     = positions?.hedgeBook          ?? [];
  const allocations   = positions?.siteAllocations    ?? [];
  const monthAllocs   = positions?.monthAllocations   ?? [];
  const settles       = positions?.latestSettles       ?? {};

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

  function handleHedgeFormDone() {
    setHedgeFormOpen(false);
    setEditing(null);
    mutate();
    hedgesMutate();
  }

  function handleHedgeFormCancel() {
    setHedgeFormOpen(false);
    setEditing(null);
  }

  function handleEdit(tradeId: number) {
    const trade = hedges.find((h) => h.id === tradeId);
    if (trade) {
      setEditing(trade);
      setHedgeFormOpen(true);
    }
  }

  async function handleDeleteConfirm() {
    if (deleteTarget === null) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v1/corn/hedges/${deleteTarget}`);
      toast.toast("Hedge trade deleted", "success");
      mutate();
      hedgesMutate();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Delete failed", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

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
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={() => {
              const headers = ["Ref", "Side", "Futures Month", "Lots", "Open Lots", "Price ($/bu)", "MTM P&L", "Status"];
              const rows = hedgeBook.map((h) => [
                h.tradeRef, h.side, h.futuresMonth, h.lots, h.openLots,
                h.entryPrice != null ? (h.entryPrice / 100).toFixed(4) : "",
                h.mtmPnlUsd != null ? h.mtmPnlUsd.toFixed(2) : "",
                h.status,
              ]);
              downloadCsv("positions.csv", toCsv(headers, rows));
            }}
            disabled={hedgeBook.length === 0}
          />
          <button
            onClick={() => {
              setEditing(null);
              setHedgeFormOpen((o) => !o);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {hedgeFormOpen && !editing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {hedgeFormOpen && !editing ? "Cancel" : "Book Hedge"}
          </button>
          <button
            onClick={() => setSettleOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg font-medium border border-slate-700 transition-colors"
          >
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Publish Settle Prices
            {settleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Book Hedge form */}
      {hedgeFormOpen && (
        <BookHedgeForm
          book={book}
          editing={editing}
          onDone={handleHedgeFormDone}
          onCancel={handleHedgeFormCancel}
        />
      )}

      {/* Settle publisher */}
      {settleOpen && (
        <SettlePublisher
          futuresMonths={allFuturesMonths.length > 0 ? allFuturesMonths : ["ZCH26", "ZCK26", "ZCN26"]}
          existingSettles={settles}
          onDone={() => { setSettleOpen(false); mutate(); }}
        />
      )}

      {/* Controls: [Book toggle] [View tabs] [Unit toggle] */}
      <div className="flex items-center gap-4">
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

        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {([
            { key: "hedge-book" as View, label: "Hedge Book" },
            { key: "allocations" as View, label: "Allocations" },
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

      </div>

      {/* Portfolio MTM Summary — always visible */}
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
            <p className="text-xs text-slate-500">{hedgeBook.length} trades &middot; {fmtVol(hedgeBook.reduce((s, h) => s + h.bushels, 0))} bu total</p>
            <p className="text-xs text-slate-500">{fmtVol(hedgeBook.reduce((s, h) => s + h.unallocatedBushels, 0))} bu unallocated</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════ HEDGE BOOK TAB ═══════════════════ */}
      {view === "hedge-book" && (
        <>
          {/* MTM P&L Chart */}
          <MtmPnlChart hedgeBook={hedgeBook} />

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
              onEdit={handleEdit}
              onDelete={(id) => setDeleteTarget(id)}
            />
          </div>
        </>
      )}

      {/* ═══════════════════ ALLOCATIONS TAB ═══════════════════ */}
      {view === "allocations" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">
              Allocations &middot; {bookLabel}
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
            onRefresh={() => mutate()}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Hedge Trade"
        description="This will permanently delete this hedge trade and all its allocations. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
