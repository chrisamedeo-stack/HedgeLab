"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { useCommodities, useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { TradeBlotter } from "@/components/trades/TradeBlotter";
import { GroupedTradeBlotter } from "@/components/trades/GroupedTradeBlotter";
import { TradeForm } from "@/components/trades/TradeForm";
import type { Commodity } from "@/hooks/usePositions";
import type { TradeFilters, TradeStatus, TradeType } from "@/types/trades";

export default function TradesPage() {
  const { orgId } = useOrgContext();
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [showForm, setShowForm] = useState(false);
  const [formCommodity, setFormCommodity] = useState<Commodity | null>(null);
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

  const handleBookTrade = () => {
    // Use filtered commodity, or first commodity, or show picker
    const filtered = (commodities ?? []).find(
      (c) => c.id === filters.commodityId
    );
    if (filtered) {
      setFormCommodity(filtered);
      setShowForm(true);
    } else if (commodities?.length === 1) {
      setFormCommodity(commodities[0]);
      setShowForm(true);
    } else {
      // Show commodity picker
      setFormCommodity(null);
      setShowForm(true);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setFormCommodity(null);
  };

  return (
    <div className="space-y-6 page-fade">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Trade Blotter</h1>
          <p className="mt-0.5 text-xs text-faint">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} &middot; book and manage financial trades
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-b-default overflow-hidden">
            <button
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "grouped"
                  ? "bg-action text-white"
                  : "bg-surface text-muted hover:text-secondary hover:bg-hover"
              }`}
            >
              Grouped
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "flat"
                  ? "bg-action text-white"
                  : "bg-surface text-muted hover:text-secondary hover:bg-hover"
              }`}
            >
              Flat
            </button>
          </div>

          <button
            onClick={handleBookTrade}
            className="flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Book Trade
          </button>
        </div>
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
      {viewMode === "grouped" ? (
        <GroupedTradeBlotter
          trades={trades}
          commodities={(commodities ?? []).map((c) => ({ id: c.id, name: c.name }))}
          sites={(sites ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          orgId={orgId}
          onRefresh={refetch}
        />
      ) : (
        <TradeBlotter
          trades={trades}
          commodities={(commodities ?? []).map((c) => ({ id: c.id, name: c.name }))}
          sites={(sites ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          orgId={orgId}
          onRefresh={refetch}
        />
      )}

      {/* Commodity picker (when no commodity selected) */}
      {showForm && !formCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-xl border border-b-default bg-[#111D32] p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-primary mb-3">Select commodity</h3>
            <div className="space-y-1">
              {(commodities ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFormCommodity(c)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-secondary hover:bg-hover transition-colors flex items-center gap-2"
                >
                  <span className="font-mono text-xs text-action bg-action/10 px-1.5 py-0.5 rounded">
                    {c.ticker_root || c.id}
                  </span>
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={closeForm}
              className="mt-3 text-xs text-faint hover:text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Book trade modal */}
      {showForm && formCommodity && (
        <TradeForm
          orgId={orgId}
          commodity={formCommodity}
          commodities={commodities ?? []}
          onClose={closeForm}
          onSuccess={() => {
            closeForm();
            refetch();
          }}
        />
      )}
    </div>
  );
}
