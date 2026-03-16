"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { useCommodities, useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { TradeBlotter } from "@/components/trades/TradeBlotter";
import { TradeForm } from "@/components/trades/TradeForm";
import type { TradeFilters, TradeStatus, TradeType } from "@/types/trades";

export default function TradesPage() {
  const { orgId } = useOrgContext();
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<Partial<TradeFilters>>({});
  const { data: trades, loading, error, refetch } = useTrades(orgId, filters);
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(orgId);

  const setFilter = (key: keyof TradeFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  return (
    <div className="space-y-6 page-fade">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Trade Blotter</h1>
          <p className="text-sm text-muted mt-0.5">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} &middot; book and manage financial trades
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Book Trade
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 rounded-lg border border-b-default bg-surface px-3 py-2">
        <select
          value={filters.commodityId ?? ""}
          onChange={(e) => setFilter("commodityId", e.target.value)}
          className="rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Commodities</option>
          {(commodities ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.tradeType ?? ""}
          onChange={(e) => setFilter("tradeType", e.target.value)}
          className="rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Types</option>
          {(["futures", "options", "swap"] as TradeType[]).map((t) => (
            <option key={t} value={t}>{t === "futures" ? "Futures" : t === "options" ? "Options" : "Swaps"}</option>
          ))}
        </select>

        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
          className="rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Statuses</option>
          {(["open", "partially_allocated", "fully_allocated", "rolled", "cancelled"] as TradeStatus[]).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>

        <input
          type="text"
          value={filters.contractMonth ?? ""}
          onChange={(e) => setFilter("contractMonth", e.target.value)}
          placeholder="Contract month (e.g. Z26)"
          className="w-44 rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary placeholder:text-faint focus:border-focus focus:outline-none"
        />

        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setFilters({})}
            className="text-xs text-faint hover:text-secondary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && trades.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading trades...</div>
      )}

      {/* Trade blotter */}
      <TradeBlotter
        trades={trades}
        commodities={(commodities ?? []).map((c) => ({ id: c.id, name: c.name }))}
        sites={(sites ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        orgId={orgId}
        onRefresh={refetch}
      />

      {/* Book trade modal */}
      {showForm && (
        <TradeForm
          orgId={orgId}
          commodities={commodities ?? []}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
