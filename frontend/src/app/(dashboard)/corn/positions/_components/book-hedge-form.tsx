"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, X } from "lucide-react";
import type { HedgeTradeResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { inputCls, btnPrimary, btnCancel } from "@/lib/corn-format";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { ZC_MONTHS, BUSHELS_PER_LOT, type Book } from "./shared";

// ─── Row type + factory ──────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

interface BookHedgeFormProps {
  book: Book;
  editing: HedgeTradeResponse | null;
  onDone: () => void;
  onCancel: () => void;
}

export function BookHedgeForm({ book, editing, onDone, onCancel }: BookHedgeFormProps) {
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

  useEffect(() => {
    if (editing) {
      setEditForm({
        futuresMonth: editing.futuresMonth,
        lots: String(editing.lots),
        pricePerBushel: String(editing.pricePerBushel),
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
        pricePerBushel: parseFloat(r.pricePerBushel),
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
        pricePerBushel: parseFloat(editForm.pricePerBushel),
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
      <form onSubmit={handleBulkSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">
            Book Hedge Trade{rows.length > 1 ? "s" : ""} — <span className="text-action">{book} Book</span>
          </h2>
          <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Broker Account</label>
            <input type="text"
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
              value={shared.brokerAccount}
              onChange={(e) => setShared((s) => ({ ...s, brokerAccount: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Trade Date</label>
            <input type="date"
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
              value={shared.tradeDate}
              onChange={(e) => setShared((s) => ({ ...s, tradeDate: e.target.value }))}
              required
            />
          </div>
        </div>

        {/* Multi-line grid */}
        <div className="rounded-lg border border-b-input overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg border-b border-b-input">
                <th className="px-3 py-2 text-left text-xs text-muted font-medium">Futures Month</th>
                <th className="px-3 py-2 text-right text-xs text-muted font-medium w-28">
                  <span>Lots</span>
                  {rows.length > 1 && rows[0]?.lots && (
                    <button type="button" onClick={applyLotsToAll}
                      className="ml-2 text-action hover:text-action transition-colors font-normal normal-case tracking-normal">
                      apply all
                    </button>
                  )}
                </th>
                <th className="px-3 py-2 text-right text-xs text-muted font-medium w-32">Bushels</th>
                <th className="px-3 py-2 text-right text-xs text-muted font-medium w-32">
                  <span>Price ($/bu)</span>
                  {rows.length > 1 && rows[0]?.pricePerBushel && (
                    <button type="button" onClick={applyPriceToAll}
                      className="ml-2 text-action hover:text-action transition-colors font-normal normal-case tracking-normal">
                      apply all
                    </button>
                  )}
                </th>
                <th className="px-3 py-2 text-right text-xs text-muted font-medium w-32">Notional</th>
                <th className="px-3 py-2 text-left text-xs text-muted font-medium">Notes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {rows.map((r) => {
                const lots = parseInt(r.lots) || 0;
                const bu = lots * BUSHELS_PER_LOT;
                const price = parseFloat(r.pricePerBushel) || 0;
                const notional = bu * price;
                const incomplete = lots > 0 && price === 0;
                return (
                  <tr key={r.key} className={cn("hover:bg-row-hover", incomplete && "bg-destructive-5")}>
                    <td className="px-3 py-1.5">
                      <select value={r.futuresMonth} onChange={(e) => updateRow(r.key, "futuresMonth", e.target.value)}
                        className="w-full bg-transparent text-secondary focus:outline-none text-sm">
                        {ZC_MONTHS.map((m) => <option key={m} className="bg-input-bg">{m}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" min="1" placeholder="e.g. 40" value={r.lots}
                        onChange={(e) => updateRow(r.key, "lots", e.target.value)}
                        className="w-full bg-transparent text-secondary text-right tabular-nums placeholder:text-ph focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-faint text-xs">
                      {bu > 0 ? formatNumber(bu) : "\u2014"}
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" step="0.0025" placeholder="e.g. 4.39" value={r.pricePerBushel}
                        onChange={(e) => updateRow(r.key, "pricePerBushel", e.target.value)}
                        className="w-full bg-transparent text-secondary text-right tabular-nums placeholder:text-ph focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                      {notional > 0
                        ? <span className="text-profit">${formatNumber(Math.round(notional))}</span>
                        : <span className="text-ph">&mdash;</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="text" placeholder="Optional" value={r.notes}
                        onChange={(e) => updateRow(r.key, "notes", e.target.value)}
                        className="w-full bg-transparent text-faint placeholder:text-ph focus:outline-none text-xs" />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(r.key)}
                          className="text-ph hover:text-destructive transition-colors">
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
                <tr className="bg-input-bg border-t border-b-input">
                  <td className="px-3 py-2 text-xs text-faint font-medium">
                    {filledRows.length} trade{filledRows.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-secondary text-sm">
                    {formatNumber(totals.totalLots)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted text-xs">
                    {formatNumber(totals.totalBu)}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums text-profit text-xs font-medium">
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
          className="flex items-center gap-1.5 text-xs text-faint hover:text-secondary transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add another month
        </button>

        {/* Single-row summary */}
        {rows.length === 1 && totals.totalLots > 0 && (
          <div className="grid grid-cols-2 gap-3 p-4 bg-input-bg rounded-lg">
            <div>
              <p className="text-xs text-faint">Bushels</p>
              <p className="text-sm font-semibold text-secondary tabular-nums">{formatNumber(totals.totalBu)}</p>
            </div>
            <div>
              <p className="text-xs text-faint">Notional (USD)</p>
              <p className="text-sm font-semibold text-secondary tabular-nums">
                {totals.totalNotional > 0 ? `$${formatNumber(Math.round(totals.totalNotional))}` : "\u2014"}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className={btnCancel}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || filledRows.length === 0}
            className={btnPrimary}>
            {submitting ? "Saving\u2026" : `Book ${filledRows.length} Hedge${filledRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    );
  }

  // ─── Edit form (single trade) ─────────────────────────────────────────────
  return (
    <form onSubmit={handleEditSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary">
          Edit <span className="text-action">{editing.tradeRef}</span>
        </h2>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Futures Month</label>
          <select
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
            value={editForm.futuresMonth}
            onChange={(e) => setEditForm((f) => ({ ...f, futuresMonth: e.target.value }))}
            required
          >
            {ZC_MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Lots (5,000 bu each)</label>
          <input
            type="number" min="1"
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
            placeholder="e.g. 40"
            value={editForm.lots}
            onChange={(e) => setEditForm((f) => ({ ...f, lots: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Price ($/bu)</label>
          <input
            type="number" step="0.0025"
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
            placeholder="e.g. 4.39"
            value={editForm.pricePerBushel}
            onChange={(e) => setEditForm((f) => ({ ...f, pricePerBushel: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Broker Account</label>
          <input
            type="text"
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
            value={editForm.brokerAccount}
            onChange={(e) => setEditForm((f) => ({ ...f, brokerAccount: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Trade Date</label>
          <input
            type="date"
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
            value={editForm.tradeDate}
            onChange={(e) => setEditForm((f) => ({ ...f, tradeDate: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Notes</label>
          <input
            type="text"
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
            placeholder="Optional"
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>

      {editLots > 0 && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-input-bg rounded-lg">
          <div>
            <p className="text-xs text-faint">Bushels</p>
            <p className="text-sm font-semibold text-secondary tabular-nums">{formatNumber(editBu)}</p>
          </div>
          <div>
            <p className="text-xs text-faint">Notional (USD)</p>
            <p className="text-sm font-semibold text-secondary tabular-nums">
              {editNotional > 0 ? `$${formatNumber(Math.round(editNotional))}` : "\u2014"}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className={btnPrimary}>
          {submitting ? "Saving\u2026" : "Update Hedge"}
        </button>
      </div>
    </form>
  );
}
