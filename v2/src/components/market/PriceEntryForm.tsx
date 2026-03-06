"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { useCommodities } from "@/hooks/usePositions";
import { useContractCalendar } from "@/hooks/useTrades";
import { useMarketStore } from "@/store/marketStore";
import type { PriceFormRow } from "@/types/market";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000010";

const emptyRow = (): PriceFormRow => ({
  contractMonth: "",
  price: "",
  openPrice: "",
  highPrice: "",
  lowPrice: "",
  volume: "",
});

interface PriceEntryFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceEntryForm({ onClose, onSuccess }: PriceEntryFormProps) {
  const { data: commodities } = useCommodities();
  const createPrices = useMarketStore((s) => s.createPrices);

  const [commodityId, setCommodityId] = useState("");
  const [priceDate, setPriceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<PriceFormRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: calendar } = useContractCalendar(commodityId || undefined);

  const addRow = useCallback(() => setRows((r) => [...r, emptyRow()]), []);
  const removeRow = useCallback(
    (i: number) => setRows((r) => r.length > 1 ? r.filter((_, idx) => idx !== i) : r),
    []
  );
  const updateRow = useCallback(
    (i: number, field: keyof PriceFormRow, value: string) =>
      setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))),
    []
  );

  const validRows = rows.filter((r) => r.contractMonth && r.price);

  const handleSubmit = async () => {
    if (!commodityId || !priceDate || validRows.length === 0) {
      setError("Select a commodity, date, and enter at least one price row.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPrices(
        validRows.map((r) => ({
          userId: DEMO_USER_ID,
          commodityId,
          contractMonth: r.contractMonth,
          priceDate,
          price: parseFloat(r.price),
          openPrice: r.openPrice ? parseFloat(r.openPrice) : undefined,
          highPrice: r.highPrice ? parseFloat(r.highPrice) : undefined,
          lowPrice: r.lowPrice ? parseFloat(r.lowPrice) : undefined,
          volume: r.volume ? parseInt(r.volume) : undefined,
        }))
      );
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Build contract month options from calendar, or fallback to typed input
  const monthOptions = calendar?.map((c) => c.contract_month) ?? [];

  return (
    <Modal open onClose={onClose} title="Enter Settlement Prices" width="max-w-3xl">
      <div className="space-y-4">
        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Commodity</label>
            <select
              value={commodityId}
              onChange={(e) => setCommodityId(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary"
            >
              <option value="">Select commodity...</option>
              {commodities?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Price Date</label>
            <input
              type="date"
              value={priceDate}
              onChange={(e) => setPriceDate(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
        </div>

        {/* Price rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default">
                <th className="px-2 py-1.5 text-left text-xs font-medium text-muted">Contract Month</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted">Settle</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted">Open</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted">High</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted">Low</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted">Volume</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-b-default">
                  <td className="px-1 py-1">
                    {monthOptions.length > 0 ? (
                      <select
                        value={row.contractMonth}
                        onChange={(e) => updateRow(i, "contractMonth", e.target.value)}
                        className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary"
                      >
                        <option value="">Select...</option>
                        {monthOptions.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="2026-07"
                        value={row.contractMonth}
                        onChange={(e) => updateRow(i, "contractMonth", e.target.value)}
                        className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary"
                      />
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) => updateRow(i, "price", e.target.value)}
                      className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-right text-sm text-primary"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.openPrice}
                      onChange={(e) => updateRow(i, "openPrice", e.target.value)}
                      className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-right text-sm text-primary"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.highPrice}
                      onChange={(e) => updateRow(i, "highPrice", e.target.value)}
                      className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-right text-sm text-primary"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.lowPrice}
                      onChange={(e) => updateRow(i, "lowPrice", e.target.value)}
                      className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-right text-sm text-primary"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      value={row.volume}
                      onChange={(e) => updateRow(i, "volume", e.target.value)}
                      className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-right text-sm text-primary"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-faint hover:text-loss"
                      title="Remove row"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRow}
          className="text-sm text-muted hover:text-secondary"
        >
          + Add row
        </button>

        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-20 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-b-default pt-3">
          <span className="text-xs text-faint">
            {validRows.length} valid row{validRows.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-hover px-4 py-2 text-sm font-medium text-secondary hover:bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || validRows.length === 0}
              className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : `Save ${validRows.length} Price${validRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
