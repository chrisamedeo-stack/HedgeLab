"use client";

import { useState, useEffect } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePmTradeStore } from "@/store/pmTradeStore";
import type { TradeInstrument, Portfolio } from "@/types/pm";

interface NewPhysicalPositionFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function NewPhysicalPositionForm({ onClose, onSuccess }: NewPhysicalPositionFormProps) {
  const { orgId } = useOrgContext();
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { nodes } = useOrgScope();
  const { createTrade } = usePmTradeStore();

  const showBasis = isEnabled("basis_trading");
  const showIndex = isEnabled("index_trading");
  const showPortfolio = isEnabled("multi_portfolio");
  const showBudgetMonth = isEnabled("budget_month");

  const [commodities, setCommodities] = useState<{ id: string; name: string }[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    tradeDate: today(),
    direction: "buy" as "buy" | "sell",
    instrument: "fixed_price" as TradeInstrument,
    quantity: "",
    commodity: "",
    basis: "",
    boardMonth: "",
    flatPrice: "",
    deliveryLocationId: "",
    portfolioId: "",
    siteId: "",
    budgetMonth: "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    fetch(`/api/kernel/commodities?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => setCommodities(Array.isArray(data) ? data : []))
      .catch(() => {});
    if (showPortfolio) {
      fetch(`/api/pm/portfolios?orgId=${orgId}`)
        .then((r) => r.json())
        .then((data) => setPortfolios(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [orgId, showPortfolio]);

  const leafNodes = nodes.filter((n) => !nodes.some((other) => other.parent_id === n.id));

  const instruments: { value: TradeInstrument; label: string }[] = [
    { value: "fixed_price", label: "Fixed Price" },
    { value: "hta", label: "HTA" },
    ...(showBasis ? [{ value: "basis" as const, label: "Basis" }] : []),
    ...(showIndex ? [{ value: "index" as const, label: "Index" }] : []),
  ];

  const showBasisField = form.instrument === "basis" || form.instrument === "hta";
  const showBoardMonth = form.instrument === "hta" || form.instrument === "basis" || form.instrument === "fixed_price";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTrade({
        orgId,
        userId: user!.id,
        tradeDate: form.tradeDate,
        category: "physical",
        commodity: form.commodity,
        instrument: form.instrument,
        direction: form.direction,
        quantity: parseFloat(form.quantity),
        basis: form.basis ? parseFloat(form.basis) : undefined,
        boardMonth: form.boardMonth || undefined,
        flatPrice: form.flatPrice ? parseFloat(form.flatPrice) : undefined,
        isPriced: form.instrument === "fixed_price" && !!form.flatPrice,
        deliveryLocationId: form.deliveryLocationId || undefined,
        portfolioId: form.portfolioId || undefined,
        siteId: form.siteId || undefined,
        budgetMonth: form.budgetMonth || undefined,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none";
  const labelClass = "block text-xs font-medium text-muted mb-1";

  return (
    <div className="rounded-lg border border-b-default bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary">New Physical Position</h3>
        <button onClick={onClose} className="text-faint hover:text-primary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive-5 border border-destructive-20 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Trade Date</label>
          <input type="date" value={form.tradeDate} onChange={(e) => set("tradeDate", e.target.value)} className={inputClass} required />
        </div>

        <div>
          <label className={labelClass}>Direction</label>
          <div className="flex gap-1">
            {(["buy", "sell"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("direction", d)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  form.direction === d
                    ? d === "buy" ? "bg-profit text-white" : "bg-loss text-white"
                    : "border border-b-input text-muted hover:bg-hover"
                }`}
              >
                {d === "buy" ? "▲ Buy" : "▼ Sell"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Instrument</label>
          <select value={form.instrument} onChange={(e) => set("instrument", e.target.value)} className={inputClass} required>
            {instruments.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Commodity</label>
          <select value={form.commodity} onChange={(e) => set("commodity", e.target.value)} className={inputClass} required>
            <option value="">Select...</option>
            {commodities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Quantity</label>
          <input type="number" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} step="0.01" required />
        </div>

        {showBasisField && (
          <div>
            <label className={labelClass}>Basis</label>
            <input type="number" value={form.basis} onChange={(e) => set("basis", e.target.value)} className={inputClass} step="0.00001" required={form.instrument === "basis"} />
          </div>
        )}

        {showBoardMonth && (
          <div>
            <label className={labelClass}>Board Month</label>
            <input type="text" value={form.boardMonth} onChange={(e) => set("boardMonth", e.target.value)} className={inputClass} placeholder="Dec 26" />
          </div>
        )}

        {form.instrument === "fixed_price" && (
          <div>
            <label className={labelClass}>Flat Price</label>
            <input type="number" value={form.flatPrice} onChange={(e) => set("flatPrice", e.target.value)} className={inputClass} step="0.00001" />
          </div>
        )}

        <div>
          <label className={labelClass}>Site</label>
          <select value={form.siteId} onChange={(e) => set("siteId", e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {leafNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Delivery Location</label>
          <select value={form.deliveryLocationId} onChange={(e) => set("deliveryLocationId", e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {leafNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>

        {showPortfolio && (
          <div>
            <label className={labelClass}>Portfolio</label>
            <select value={form.portfolioId} onChange={(e) => set("portfolioId", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {showBudgetMonth && (
          <div>
            <label className={labelClass}>Budget Month</label>
            <input type="month" value={form.budgetMonth} onChange={(e) => set("budgetMonth", e.target.value)} className={inputClass} />
          </div>
        )}

        <div className="col-span-full flex items-center justify-end gap-3 pt-2 border-t border-b-default">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Position"}
          </button>
        </div>
      </form>
    </div>
  );
}
