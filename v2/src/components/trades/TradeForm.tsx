"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTradeStore } from "@/store/tradeStore";
import { useContractCalendar } from "@/hooks/useTrades";
import type { TradeFormRow, CreateTradeParams } from "@/types/trades";
import type { Direction } from "@/types/positions";

const USER_ID = "00000000-0000-0000-0000-000000000010"; // demo admin

interface TradeFormProps {
  orgId: string;
  commodities: { id: string; name: string; contract_size?: number }[];
  onClose: () => void;
  onSuccess: () => void;
}

function emptyRow(): TradeFormRow {
  return {
    key: crypto.randomUUID(),
    commodityId: "",
    direction: "long",
    contractMonth: "",
    numContracts: "",
    contractSize: "",
    tradePrice: "",
    notes: "",
  };
}

export function TradeForm({ orgId, commodities, onClose, onSuccess }: TradeFormProps) {
  const { createTrades } = useTradeStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared fields
  const [broker, setBroker] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));

  // Multi-row grid
  const [rows, setRows] = useState<TradeFormRow[]>([emptyRow()]);

  // Contract calendar for selected commodity (first row drives this for UX simplicity)
  const firstCommodity = rows[0]?.commodityId;
  const { data: contractMonths } = useContractCalendar(firstCommodity || undefined);

  const updateRow = (key: string, field: keyof TradeFormRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        // Auto-fill contract size when commodity changes
        if (field === "commodityId") {
          const c = commodities.find((c) => c.id === value);
          if (c?.contract_size) updated.contractSize = String(c.contract_size);
        }
        return updated;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (key: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const calcVolume = (r: TradeFormRow) => {
    const n = Number(r.numContracts) || 0;
    const s = Number(r.contractSize) || 0;
    return n * s;
  };

  const calcNotional = (r: TradeFormRow) => {
    const v = calcVolume(r);
    const p = Number(r.tradePrice) || 0;
    return v * p;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const validRows = rows.filter(
        (r) => r.commodityId && r.contractMonth && r.numContracts && r.contractSize && r.tradePrice
      );

      if (validRows.length === 0) {
        setError("At least one complete row is required");
        setSubmitting(false);
        return;
      }

      const params: CreateTradeParams[] = validRows.map((r) => ({
        orgId,
        userId: USER_ID,
        commodityId: r.commodityId,
        direction: r.direction as Direction,
        tradeDate,
        contractMonth: r.contractMonth,
        broker: broker || undefined,
        numContracts: Number(r.numContracts),
        contractSize: Number(r.contractSize),
        tradePrice: Number(r.tradePrice),
        notes: r.notes || undefined,
      }));

      await createTrades(params);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Book Trades" width="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Trade Date *</span>
            <input
              type="date"
              required
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Broker</span>
            <input
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
              placeholder="e.g. ADM, Marex"
            />
          </label>
        </div>

        {/* Multi-row grid */}
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_80px_120px_80px_90px_90px_1fr_32px] gap-1.5 text-xs font-medium text-muted px-1">
            <span>Commodity</span>
            <span>Dir</span>
            <span>Contract Mo</span>
            <span>Contracts</span>
            <span>Size</span>
            <span>Price</span>
            <span>Notes</span>
            <span></span>
          </div>

          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_80px_120px_80px_90px_90px_1fr_32px] gap-1.5 items-center">
              <select
                value={row.commodityId}
                onChange={(e) => updateRow(row.key, "commodityId", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
              >
                <option value="">Commodity...</option>
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={row.direction}
                onChange={(e) => updateRow(row.key, "direction", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>

              {contractMonths.length > 0 ? (
                <select
                  value={row.contractMonth}
                  onChange={(e) => updateRow(row.key, "contractMonth", e.target.value)}
                  className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                >
                  <option value="">Month...</option>
                  {contractMonths.map((m) => (
                    <option key={m.contract_month} value={m.contract_month}>{m.contract_month}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={row.contractMonth}
                  onChange={(e) => updateRow(row.key, "contractMonth", e.target.value)}
                  className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                  placeholder="Z26"
                />
              )}

              <input
                type="number"
                min="1"
                value={row.numContracts}
                onChange={(e) => updateRow(row.key, "numContracts", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none tabular-nums"
                placeholder="10"
              />

              <input
                type="number"
                step="any"
                value={row.contractSize}
                onChange={(e) => updateRow(row.key, "contractSize", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none tabular-nums"
                placeholder="5000"
              />

              <input
                type="number"
                step="any"
                value={row.tradePrice}
                onChange={(e) => updateRow(row.key, "tradePrice", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none tabular-nums"
                placeholder="450.25"
              />

              <input
                type="text"
                value={row.notes}
                onChange={(e) => updateRow(row.key, "notes", e.target.value)}
                className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                placeholder="Optional notes"
              />

              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-hover hover:text-loss disabled:opacity-30"
                disabled={rows.length <= 1}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Calculated totals */}
        {rows.some((r) => Number(r.numContracts) > 0) && (
          <div className="rounded-md bg-surface border border-b-default px-3 py-2 text-xs text-muted">
            <div className="flex gap-6">
              <span>
                Rows: <span className="text-secondary font-medium">{rows.filter((r) => r.commodityId && r.numContracts).length}</span>
              </span>
              <span>
                Total Volume: <span className="text-secondary font-medium tabular-nums">{rows.reduce((s, r) => s + calcVolume(r), 0).toLocaleString()}</span>
              </span>
              <span>
                Notional: <span className="text-secondary font-medium tabular-nums">${rows.reduce((s, r) => s + calcNotional(r), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 rounded-lg border border-b-input px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-hover"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
            >
              {submitting ? "Booking..." : `Book ${rows.filter((r) => r.commodityId && r.numContracts).length} Trade(s)`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
