"use client";

import { useEffect, useState } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import type { TradeCategory, TradeInstrument, TradeDirection, PmTradeFilters } from "@/types/pm";

interface PositionFiltersProps {
  tab: TradeCategory;
  filters: PmTradeFilters;
  onChange: (filters: PmTradeFilters) => void;
}

const FINANCIAL_INSTRUMENTS: { value: TradeInstrument; label: string; flag?: string }[] = [
  { value: "futures", label: "Futures" },
  { value: "swap_otc", label: "Swap OTC", flag: "swap_trading" },
  { value: "call_option", label: "Call Option", flag: "options_trading" },
  { value: "put_option", label: "Put Option", flag: "options_trading" },
];

const PHYSICAL_INSTRUMENTS: { value: TradeInstrument; label: string; flag?: string }[] = [
  { value: "fixed_price", label: "Fixed Price" },
  { value: "hta", label: "HTA" },
  { value: "basis", label: "Basis", flag: "basis_trading" },
  { value: "index", label: "Index", flag: "index_trading" },
];

const FINANCIAL_DIRECTIONS: { value: TradeDirection; label: string }[] = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const PHYSICAL_DIRECTIONS: { value: TradeDirection; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];

interface Commodity {
  id: string;
  name: string;
}

export function PositionFilters({ tab, filters, onChange }: PositionFiltersProps) {
  const { orgId } = useOrgContext();
  const { isEnabled } = useFeatureFlags();
  const [commodities, setCommodities] = useState<Commodity[]>([]);

  useEffect(() => {
    fetch(`/api/kernel/commodities?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => setCommodities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [orgId]);

  const instruments = tab === "financial" ? FINANCIAL_INSTRUMENTS : PHYSICAL_INSTRUMENTS;
  const directions = tab === "financial" ? FINANCIAL_DIRECTIONS : PHYSICAL_DIRECTIONS;
  const filteredInstruments = instruments.filter((i) => !i.flag || isEnabled(i.flag as never));

  const set = (key: keyof PmTradeFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  // Collect active filter chips
  const activeChips: { key: keyof PmTradeFilters; label: string }[] = [];
  if (filters.commodity) activeChips.push({ key: "commodity", label: `Commodity: ${filters.commodity}` });
  if (filters.instrument) activeChips.push({ key: "instrument", label: `Instrument: ${filters.instrument}` });
  if (filters.direction) activeChips.push({ key: "direction", label: `Direction: ${filters.direction}` });
  if (tab === "physical" && filters.isPriced !== undefined) {
    activeChips.push({ key: "isPriced", label: filters.isPriced ? "Priced" : "Unpriced" });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Commodity */}
        <select
          value={filters.commodity ?? ""}
          onChange={(e) => set("commodity", e.target.value)}
          className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Commodities</option>
          {commodities.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Instrument */}
        <select
          value={filters.instrument ?? ""}
          onChange={(e) => set("instrument", e.target.value)}
          className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Instruments</option>
          {filteredInstruments.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>

        {/* Direction */}
        <select
          value={filters.direction ?? ""}
          onChange={(e) => set("direction", e.target.value)}
          className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
        >
          <option value="">All Directions</option>
          {directions.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        {/* Priced filter (physical only) */}
        {tab === "physical" && (
          <select
            value={filters.isPriced === undefined ? "" : String(filters.isPriced)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...filters, isPriced: v === "" ? undefined : v === "true" });
            }}
            className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="true">Priced</option>
            <option value="false">Unpriced</option>
          </select>
        )}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => set(chip.key, undefined)}
              className="flex items-center gap-1 rounded-full bg-action-10 px-2.5 py-0.5 text-xs text-action hover:bg-action-15 transition-colors"
            >
              {chip.label}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
