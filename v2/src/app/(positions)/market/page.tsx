"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePriceBoard, useUpload, usePrices } from "@/hooks/useMarket";
import { useForwardCurve } from "@/hooks/useMarket";
import { useCommodities } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { KPICard } from "@/components/ui/KPICard";
import { TabGroup } from "@/components/ui/TabGroup";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceEntryForm } from "@/components/market/PriceEntryForm";
import { btnPrimary, btnSecondary } from "@/lib/ui-classes";
import { API_BASE } from "@/lib/api";
import { ForwardCurveChart } from "@/components/charts/ForwardCurveChart";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { formatContractMonth } from "@/lib/commodity-utils";
import { chartColors, tooltipStyle } from "@/lib/chartTheme";
import type { MarketTab, PriceBoardRow, MarketPrice } from "@/types/market";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n && n !== 0) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtNum(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtChange(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  const prefix = n > 0 ? "+" : "";
  return prefix + n.toFixed(4);
}

function changeColor(v: number | null): string {
  if (v === null || v === undefined) return "text-muted";
  const n = Number(v);
  if (n > 0) return "text-profit";
  if (n < 0) return "text-loss";
  return "text-muted";
}

// ─── Price Board Tab ────────────────────────────────────────────────────────

function PriceBoardTab() {
  const { commodityId } = useCommodityContext();
  const { data: boardRows, loading, refetch } = usePriceBoard(commodityId ?? undefined);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/market/prices/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setRefreshMsg({ type: "success", text: `${data.upserted} prices updated` });
      refetch();
    } catch (err) {
      setRefreshMsg({ type: "error", text: (err as Error).message });
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 5000);
    }
  }, [refetch]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(refetch, 60_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Group by commodity
  const grouped = boardRows.reduce<Record<string, { name: string; rows: PriceBoardRow[] }>>((acc, r) => {
    if (!acc[r.commodity_id]) {
      acc[r.commodity_id] = { name: r.commodity_name, rows: [] };
    }
    acc[r.commodity_id].rows.push(r);
    return acc;
  }, {});

  const commodityGroups = Object.entries(grouped);
  const lastUpdate = boardRows.length > 0
    ? boardRows.reduce((latest, r) => (r.price_date > latest ? r.price_date : latest), boardRows[0].price_date)
    : null;
  const totalChanges = boardRows.filter((r) => r.change !== null && Number(r.change) !== 0).length;

  const columns: Column<PriceBoardRow>[] = [
    { key: "contract_month", header: "Contract", width: "100px", render: (r) => formatContractMonth(r.contract_month) },
    { key: "settle", header: "Settle", align: "right", render: (r) => fmtPrice(r.settle) },
    {
      key: "change", header: "Change", align: "right",
      render: (r) => (
        <span className={changeColor(r.change)}>{fmtChange(r.change)}</span>
      ),
    },
    {
      key: "change_percent", header: "%", align: "right", width: "70px",
      render: (r) => (
        <span className={changeColor(r.change_percent)}>
          {r.change_percent !== null ? `${Number(r.change_percent) > 0 ? "+" : ""}${r.change_percent}%` : "—"}
        </span>
      ),
    },
    { key: "high_price", header: "High", align: "right", render: (r) => fmtPrice(r.high_price) },
    { key: "low_price", header: "Low", align: "right", render: (r) => fmtPrice(r.low_price) },
    { key: "volume", header: "Volume", align: "right", render: (r) => fmtNum(r.volume) },
    { key: "open_interest", header: "OI", align: "right", render: (r) => fmtNum(r.open_interest) },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Commodities Tracked" value={String(commodityGroups.length)} />
        <KPICard label="Last Update" value={lastUpdate ? new Date(lastUpdate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No data"} />
        <KPICard label="Price Changes" value={String(totalChanges)} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {refreshMsg && (
          <span className={`text-xs ${refreshMsg.type === "success" ? "text-profit" : "text-loss"}`}>
            {refreshMsg.text}
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={btnSecondary}
        >
          {refreshing ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.49-8.49l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Refresh Prices
            </>
          )}
        </button>
        <button
          onClick={() => setShowEntryForm(true)}
          className={btnPrimary}
        >
          Enter Prices
        </button>
      </div>

      {/* Commodity Tables */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : commodityGroups.length === 0 ? (
        <EmptyState
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          title="No price data available"
          description="Click &quot;Enter Prices&quot; to add settlement data"
          actionLabel="Enter Prices"
          onAction={() => setShowEntryForm(true)}
        />
      ) : (
        commodityGroups.map(([commId, group]) => (
          <div key={commId} className="rounded-lg border border-b-default bg-surface">
            <div className="border-b border-b-default px-4 py-2.5">
              <h2 className="text-sm font-semibold text-secondary">
                {group.name}
                <span className="ml-2 text-xs font-normal text-faint">({group.rows.length} contracts)</span>
              </h2>
            </div>
            <DataTable<PriceBoardRow> columns={columns} data={group.rows} emptyMessage="No data" />
          </div>
        ))
      )}

      {showEntryForm && (
        <PriceEntryForm
          onClose={() => setShowEntryForm(false)}
          onSuccess={() => { setShowEntryForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Chart Tab ──────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

function ChartTab() {
  const { data: commodities } = useCommodities();
  const { commodityId: ctxCommodityId } = useCommodityContext();
  const [commodityId, setCommodityId] = useState(ctxCommodityId ?? "");
  const [contractMonth, setContractMonth] = useState("");
  const [timeframe, setTimeframe] = useState(90);

  useEffect(() => {
    if (ctxCommodityId) setCommodityId(ctxCommodityId);
  }, [ctxCommodityId]);

  const dateFrom = new Date(Date.now() - timeframe * 86_400_000).toISOString().split("T")[0];
  const { data: prices, loading } = usePrices(
    commodityId && contractMonth
      ? { commodityId, contractMonth, dateFrom }
      : undefined
  );

  // Get available contract months
  const months = [...new Set(prices.map((p) => p.contract_month))].sort();
  useEffect(() => {
    if (months.length > 0 && !contractMonth) {
      setContractMonth(months[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.length]);

  // Filter to selected month and build OHLC data
  const filteredPrices = prices.filter((p) => p.contract_month === contractMonth);
  const candleData = filteredPrices
    .filter((p) => p.open_price && p.high_price && p.low_price)
    .map((p) => ({
      time: p.price_date,
      open: Number(p.open_price),
      high: Number(p.high_price),
      low: Number(p.low_price),
      close: Number(p.price),
    }));

  const volumeData = filteredPrices
    .filter((p) => p.volume)
    .map((p) => ({
      time: p.price_date,
      value: Number(p.volume),
    }));

  // Fallback: line chart data if insufficient OHLC
  const hasOHLC = candleData.length >= 5;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Commodity</label>
          <select
            value={commodityId}
            onChange={(e) => { setCommodityId(e.target.value); setContractMonth(""); }}
            className="rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary"
          >
            <option value="">Select...</option>
            {commodities?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Contract Month</label>
          <select
            value={contractMonth}
            onChange={(e) => setContractMonth(e.target.value)}
            className="rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary"
          >
            <option value="">Select...</option>
            {months.map((m) => (
              <option key={m} value={m}>{formatContractMonth(m)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              onClick={() => setTimeframe(t.days)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
                timeframe === t.days
                  ? "bg-action text-primary"
                  : "bg-input-bg text-muted hover:bg-hover hover:text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="py-20 text-center text-faint">Loading chart data...</div>
      ) : !commodityId || !contractMonth ? (
        <div className="rounded-lg border border-b-default bg-surface py-20 text-center">
          <span className="text-sm text-faint">Select a commodity and contract month to view the chart</span>
        </div>
      ) : hasOHLC ? (
        <div className="rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            {formatContractMonth(contractMonth)} Price Chart
          </h3>
          <CandlestickChart
            data={candleData}
            volume={volumeData.length > 0 ? volumeData : undefined}
            height={400}
          />
        </div>
      ) : (
        <LineChartFallback prices={filteredPrices} contractMonth={contractMonth} />
      )}
    </div>
  );
}

/** Recharts line chart fallback when insufficient OHLC data */
function LineChartFallback({ prices, contractMonth }: { prices: MarketPrice[]; contractMonth: string }) {
  // Lazy import to keep bundle light if not needed
  const [RechartsMod, setRechartsMod] = useState<typeof import("recharts") | null>(null);

  useEffect(() => {
    import("recharts").then(setRechartsMod);
  }, []);

  if (!RechartsMod) return <div className="py-20 text-center text-faint">Loading chart...</div>;

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = RechartsMod;

  const data = [...prices]
    .sort((a, b) => a.price_date.localeCompare(b.price_date))
    .map((p) => ({ date: p.price_date, price: Number(p.price) }));

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-b-default bg-surface py-20 text-center">
        <span className="text-sm text-faint">No price data for {formatContractMonth(contractMonth)}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        {formatContractMonth(contractMonth)} Settlement Prices
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis dataKey="date" stroke={chartColors.tick} fontSize={11} tickLine={false} />
          <YAxis stroke={chartColors.tick} fontSize={11} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number | undefined) => value != null ? [`$${value.toFixed(4)}`, "Price"] : ["—", "Price"]}
          />
          <Line dataKey="price" stroke={chartColors.action} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Forward Curves Tab ─────────────────────────────────────────────────────

function CurvesTab() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const [compareDate, setCompareDate] = useState<string | undefined>();
  const { data: forwardCurve } = useForwardCurve(orgId, commodityId ?? undefined, compareDate);

  return (
    <div className="space-y-4">
      <ForwardCurveChart
        current={forwardCurve?.current ?? []}
        comparison={forwardCurve?.comparison ?? null}
        compareDate={forwardCurve?.compareDate ?? null}
        onCompareChange={setCompareDate}
        height={400}
      />
    </div>
  );
}

// ─── Upload Tab ─────────────────────────────────────────────────────────────

function UploadTab() {
  const { preview, uploading, error, handleFileSelect, handleCommit, clearUpload } = useUpload();
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [commitResult, setCommitResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const doCommit = useCallback(async () => {
    try {
      const result = await handleCommit();
      if (result) setCommitResult(result);
    } catch {
      // error is in store
    }
  }, [handleCommit]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!preview && (
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-action bg-action-10" : "border-b-default bg-surface hover:border-action"
          }`}
        >
          <svg className="h-12 w-12 text-faint mb-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-secondary font-medium">
            Drop Excel/CSV file here or click to browse
          </p>
          <p className="text-xs text-faint mt-1">Supports .xlsx, .xls, .csv</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileInput}
            className="hidden"
          />
        </div>
      )}

      {uploading && (
        <div className="py-8 text-center text-faint">Processing file...</div>
      )}

      {error && (
        <div className="rounded-lg bg-loss/10 border border-loss/20 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Commit result */}
      {commitResult && (
        <div className="rounded-lg bg-profit/10 border border-profit/20 px-4 py-3 text-sm text-profit">
          Upload complete: {commitResult.inserted} inserted, {commitResult.updated} updated, {commitResult.skipped} skipped
          <button onClick={() => setCommitResult(null)} className="ml-4 text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Preview */}
      {preview && !commitResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-secondary">{preview.filename}</h3>
              <p className="text-xs text-muted mt-0.5">
                {preview.totalRows} rows parsed &middot;{" "}
                <span className="text-profit">{preview.validRows} valid</span>
                {preview.errorRows > 0 && (
                  <> &middot; <span className="text-loss">{preview.errorRows} errors</span></>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={clearUpload} className="rounded bg-input-bg px-3 py-1.5 text-sm text-muted hover:text-secondary transition-colors">
                Cancel
              </button>
              <button
                onClick={doCommit}
                disabled={uploading || preview.validRows === 0}
                className="rounded bg-action px-4 py-1.5 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-50 transition-colors"
              >
                Commit {preview.validRows} Rows
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-b-default bg-surface max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Commodity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Contract</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted">Settle</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-b-default">
                {preview.rows.map((r) => (
                  <tr key={r.row} className={r.status === "error" ? "bg-loss/5" : ""}>
                    <td className="px-3 py-1.5 text-faint">{r.row + 1}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        r.status === "valid" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-secondary">{r.commodityId || "—"}</td>
                    <td className="px-3 py-1.5 text-secondary">{formatContractMonth(r.contractMonth)}</td>
                    <td className="px-3 py-1.5 text-secondary">{r.priceDate || "—"}</td>
                    <td className="px-3 py-1.5 text-right text-secondary">{fmtPrice(r.settle)}</td>
                    <td className="px-3 py-1.5 text-xs text-loss">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const TABS: { key: MarketTab; label: string }[] = [
  { key: "board", label: "Price Board" },
  { key: "chart", label: "Chart" },
  { key: "curves", label: "Forward Curves" },
  { key: "upload", label: "Upload" },
];

export default function MarketViewPage() {
  const [tab, setTab] = useState<MarketTab>("board");

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Market View</h1>
        <p className="mt-0.5 text-xs text-faint">Prices, charts, forward curves, and data upload</p>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
        active={tab}
        onChange={(key) => setTab(key as MarketTab)}
      />

      {/* Content */}
      {tab === "board" && <PriceBoardTab />}
      {tab === "chart" && <ChartTab />}
      {tab === "curves" && <CurvesTab />}
      {tab === "upload" && <UploadTab />}
    </div>
  );
}
