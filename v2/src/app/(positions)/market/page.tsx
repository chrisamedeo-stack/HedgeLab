"use client";

import { useState } from "react";
import { usePrices } from "@/hooks/useMarket";
import { useCommodities } from "@/hooks/usePositions";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PriceEntryForm } from "@/components/market/PriceEntryForm";
import type { MarketPrice, PriceFilters } from "@/types/market";

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtNum(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function MarketDataPage() {
  const { data: commodities } = useCommodities();

  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [contractMonth, setContractMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);

  const filters: PriceFilters = {
    commodityId: selectedCommodity ?? undefined,
    contractMonth: contractMonth || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: prices, loading, refetch } = usePrices(filters);

  const columns: Column<MarketPrice>[] = [
    { key: "price_date", header: "Date", width: "100px" },
    {
      key: "commodity_name", header: "Commodity",
      render: (r) => r.commodity_name ?? r.commodity_id,
    },
    { key: "contract_month", header: "Contract", width: "90px" },
    { key: "price", header: "Settle", align: "right", render: (r) => fmtPrice(r.price) },
    { key: "open_price", header: "Open", align: "right", render: (r) => fmtPrice(r.open_price) },
    { key: "high_price", header: "High", align: "right", render: (r) => fmtPrice(r.high_price) },
    { key: "low_price", header: "Low", align: "right", render: (r) => fmtPrice(r.low_price) },
    { key: "volume", header: "Volume", align: "right", render: (r) => fmtNum(r.volume) },
    {
      key: "source", header: "Source", width: "80px",
      render: (r) => (
        <span className="rounded bg-hover px-1.5 py-0.5 text-xs text-muted">
          {r.source}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Market Data</h1>
          <p className="text-sm text-faint">Settlement prices and market data</p>
        </div>
        <button
          onClick={() => setShowEntryForm(true)}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          Enter Prices
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {commodities && (
          <CommodityFilter
            commodities={commodities}
            selected={selectedCommodity}
            onSelect={setSelectedCommodity}
          />
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Contract Month</label>
          <input
            type="text"
            placeholder="e.g. 2026-07"
            value={contractMonth}
            onChange={(e) => setContractMonth(e.target.value)}
            className="rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary placeholder:text-ph"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary"
          />
        </div>
      </div>

      {/* Price table */}
      <div className="rounded-lg border border-b-default bg-surface">
        <div className="border-b border-b-default px-4 py-2.5">
          <h2 className="text-sm font-semibold text-secondary">
            Price History
            <span className="ml-2 text-xs font-normal text-faint">({prices.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-faint">Loading prices...</div>
        ) : (
          <DataTable<MarketPrice>
            columns={columns}
            data={prices}
            emptyMessage="No prices found. Click 'Enter Prices' to add settlement data."
          />
        )}
      </div>

      {/* Entry form modal */}
      {showEntryForm && (
        <PriceEntryForm
          onClose={() => setShowEntryForm(false)}
          onSuccess={() => { setShowEntryForm(false); refetch(); }}
        />
      )}
    </div>
  );
}
