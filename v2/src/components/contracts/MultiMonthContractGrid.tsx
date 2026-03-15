"use client";

import { useState, useMemo, useCallback } from "react";
import { generateMonthRange, monthLabel } from "@/lib/commodity-utils";
import { useContractStore } from "@/hooks/useContracts";
import type { ContractType, ContractDirection, ContractPricingType } from "@/types/contracts";

interface MonthRow {
  month: string; // "2026-01"
  volume: number;
  notes: string;
}

interface Props {
  orgId: string;
  userId: string;
  defaultCommodityId?: string;
  counterparties: { id: string; name: string }[];
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function MultiMonthContractGrid({
  orgId,
  userId,
  defaultCommodityId,
  counterparties,
  commodities,
  sites,
  onSaved,
  onCancel,
}: Props) {
  const { createBulkContracts } = useContractStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared config
  const [contractType, setContractType] = useState<ContractType>("purchase");
  const [direction, setDirection] = useState<ContractDirection>("buy");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [commodityId, setCommodityId] = useState(defaultCommodityId ?? "");
  const [siteId, setSiteId] = useState("");
  const [pricingType, setPricingType] = useState<ContractPricingType>("fixed");
  const [price, setPrice] = useState("");
  const [basisPrice, setBasisPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));

  // Month range
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [startMonth, setStartMonth] = useState(defaultStart);
  const [endMonth, setEndMonth] = useState(defaultStart);

  // Default volume
  const [defaultVolume, setDefaultVolume] = useState("");

  // Per-month rows
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);

  // Regenerate month rows when range changes
  const months = useMemo(() => {
    if (!startMonth || !endMonth || startMonth > endMonth) return [];
    return generateMonthRange(startMonth, endMonth);
  }, [startMonth, endMonth]);

  // Sync rows when months change
  const syncRows = useCallback(
    (newMonths: string[]) => {
      setMonthRows((prev) => {
        const existing = new Map(prev.map((r) => [r.month, r]));
        return newMonths.map((m) => existing.get(m) ?? { month: m, volume: 0, notes: "" });
      });
    },
    []
  );

  // Effect-like: sync when months array identity changes
  useMemo(() => {
    syncRows(months);
  }, [months, syncRows]);

  function applyDefaultVolume() {
    const vol = Number(defaultVolume);
    if (!vol || vol <= 0) return;
    setMonthRows((prev) => prev.map((r) => ({ ...r, volume: vol })));
  }

  function updateRow(month: string, field: "volume" | "notes", value: string) {
    setMonthRows((prev) =>
      prev.map((r) =>
        r.month === month
          ? { ...r, [field]: field === "volume" ? Number(value) || 0 : value }
          : r
      )
    );
  }

  const totalVolume = monthRows.reduce((sum, r) => sum + r.volume, 0);
  const activeRows = monthRows.filter((r) => r.volume > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeRows.length === 0) {
      setError("At least one month must have volume > 0");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const paramsList = activeRows.map((row) => {
        const [y, m] = row.month.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return {
          orgId,
          userId,
          counterpartyId: counterpartyId || undefined,
          commodityId: commodityId || undefined,
          siteId: siteId || undefined,
          contractType,
          direction,
          pricingType,
          totalVolume: row.volume,
          price: price ? Number(price) : undefined,
          basisPrice: basisPrice ? Number(basisPrice) : undefined,
          currency,
          deliveryStart: `${row.month}-01`,
          deliveryEnd: `${row.month}-${String(lastDay).padStart(2, "0")}`,
          notes: row.notes || undefined,
        };
      });
      await createBulkContracts(paramsList);
      onSaved();
    } catch {
      // store handles error state
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">Multi-Month Contract</h3>
        <span className="text-xs text-faint">Creates one contract per month</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shared Config Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Contract Type *</label>
            <select
              required
              value={contractType}
              onChange={(e) => {
                const ct = e.target.value as ContractType;
                setContractType(ct);
                setDirection(ct === "purchase" ? "buy" : "sell");
              }}
              className={inputClass}
            >
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Counterparty</label>
            <select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)} className={inputClass}>
              <option value="">Select counterparty</option>
              {counterparties.map((cp) => (
                <option key={cp.id} value={cp.id}>{cp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Commodity</label>
            <select value={commodityId} onChange={(e) => setCommodityId(e.target.value)} className={inputClass}>
              <option value="">Select commodity</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputClass}>
              <option value="">Select site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Pricing Type</label>
            <select value={pricingType} onChange={(e) => setPricingType(e.target.value as ContractPricingType)} className={inputClass}>
              <option value="fixed">Fixed</option>
              <option value="basis">Basis</option>
              <option value="formula">Formula</option>
            </select>
          </div>
          {pricingType === "fixed" && (
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Price</label>
              <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          )}
          {pricingType === "basis" && (
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Basis Price</label>
              <input type="number" step="any" value={basisPrice} onChange={(e) => setBasisPrice(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {/* Month Range Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Start Month *</label>
            <input
              type="month"
              required
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">End Month *</label>
            <input
              type="month"
              required
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">Contract Date</label>
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Default Volume */}
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[240px]">
            <label className="block text-xs font-medium text-faint mb-1">Default Volume</label>
            <input
              type="number"
              step="any"
              value={defaultVolume}
              onChange={(e) => setDefaultVolume(e.target.value)}
              placeholder="Volume per month"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={applyDefaultVolume}
            disabled={!defaultVolume || Number(defaultVolume) <= 0}
            className="rounded-lg border border-b-input px-3 py-2 text-sm text-secondary hover:bg-input-bg transition-colors disabled:opacity-50"
          >
            Apply to all months
          </button>
          <span className="text-xs text-faint pb-2">Sets all months — override individually below</span>
        </div>

        {/* Monthly Grid */}
        {months.length > 0 && (
          <div className="bg-elevated border border-b-default rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-b-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-faint uppercase tracking-wider">Month</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-faint uppercase tracking-wider">Volume</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-faint uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-b-default">
                {monthRows.map((row) => (
                  <tr key={row.month} className="hover:bg-row-hover">
                    <td className="px-4 py-2 text-secondary font-medium text-sm">{monthLabel(row.month)}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="any"
                        value={row.volume || ""}
                        onChange={(e) => updateRow(row.month, "volume", e.target.value)}
                        className="w-32 bg-input-bg border border-b-input text-primary rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-focus"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateRow(row.month, "notes", e.target.value)}
                        className="w-full bg-input-bg border border-b-input text-primary rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
                        placeholder="Optional"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-b-default">
                <tr>
                  <td className="px-4 py-2 text-sm font-semibold text-primary">Total</td>
                  <td className="px-4 py-2 text-sm font-semibold text-primary tabular-nums">
                    {totalVolume.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-faint">
                    {activeRows.length} month{activeRows.length !== 1 ? "s" : ""} with volume
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || activeRows.length === 0}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
          >
            {submitting
              ? "Creating..."
              : `Create ${activeRows.length} Contract${activeRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
