"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch, inputCls, selectCls, btnPrimary, cn } from "./shared";
import { formatContractMonth } from "@/lib/commodity-utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  is_primary: boolean;
}

interface SymbolMapping {
  provider_id: string;
  provider_symbol: string;
  provider_root: string | null;
  provider_name?: string;
}

interface PriceRow {
  contract_month: string;
  price: string;
  open_price: string | null;
  high_price: string | null;
  low_price: string | null;
  volume: string | null;
  open_interest: string | null;
  source: string;
  price_date: string;
}

interface PriceStatus {
  provider: string | null;
  providerId: string | null;
  lastUpdate: string | null;
  contractsPriced: number;
  totalContracts: number;
  historyDays: number;
  earliestDate: string | null;
}

interface MtmCoverage {
  openPositions: number;
  withPrice: number;
  missingPrice: number;
  missingMonths: string[];
}

interface LatestPricesResponse {
  prices: PriceRow[];
  expectedMonths: string[];
  missingMonths: string[];
}

interface MarketDataTabProps {
  commodityId: string;
  commodityName: string;
  tickerRoot: string;
  tradePriceUnit: string;
  priceDecimalPlaces: number;
  config: Record<string, unknown> | null;
}

// ─── Source Badge ───────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, string> = {
  excel: "bg-swap-5 text-swap",
  manual: "bg-accent-10 text-muted",
  api: "bg-action-10 text-action",
  missing: "bg-destructive-10 text-destructive",
};

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.manual;
  return (
    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium", style)}>
      {source}
    </span>
  );
}

// ─── Change Cell ────────────────────────────────────────────────────────────

function ChangeCell({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return <span className="text-faint">—</span>;
  const change = current - previous;
  if (change === 0) return <span className="text-muted tabular-nums">0.00</span>;
  const isPositive = change > 0;
  return (
    <span className={cn("tabular-nums", isPositive ? "text-profit" : "text-loss")}>
      {isPositive ? "+" : ""}{change.toFixed(4)}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MarketDataTab({
  commodityId,
  commodityName,
  tickerRoot,
  tradePriceUnit,
  priceDecimalPlaces,
  config,
}: MarketDataTabProps) {
  // ─── State ─────────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mapping, setMapping] = useState<SymbolMapping | null>(null);
  const [latestData, setLatestData] = useState<LatestPricesResponse | null>(null);
  const [status, setStatus] = useState<PriceStatus | null>(null);
  const [mtmCoverage, setMtmCoverage] = useState<MtmCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for price source mapping
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [providerSymbol, setProviderSymbol] = useState(tickerRoot || "");
  const [mtmPriceType, setMtmPriceType] = useState("settlement");
  const [excelColumnName, setExcelColumnName] = useState(commodityId);

  // ─── Load data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [providersRes, mappingRes, latestRes, statusRes, mtmRes] = await Promise.allSettled([
        apiFetch("/api/market/providers"),
        apiFetch(`/api/market/symbol-map?commodityId=${commodityId}`),
        apiFetch(`/api/market/prices/latest?commodityId=${commodityId}&includeExpected=true`),
        apiFetch(`/api/market/prices/status?commodityId=${commodityId}`),
        apiFetch(`/api/market/prices/mtm-coverage?commodityId=${commodityId}`),
      ]);

      if (providersRes.status === "fulfilled") setProviders(providersRes.value);
      if (mappingRes.status === "fulfilled" && Array.isArray(mappingRes.value) && mappingRes.value.length > 0) {
        const m = mappingRes.value[0];
        setMapping(m);
        setSelectedProviderId(m.provider_id);
        setProviderSymbol(m.provider_symbol || tickerRoot || "");
      }
      if (latestRes.status === "fulfilled") setLatestData(latestRes.value);
      if (statusRes.status === "fulfilled") setStatus(statusRes.value);
      if (mtmRes.status === "fulfilled") setMtmCoverage(mtmRes.value);

      // Load config values
      const cfg = config as Record<string, unknown> | null;
      if (cfg?.mtm_price_type) setMtmPriceType(cfg.mtm_price_type as string);
      if (cfg?.excel_column_name) setExcelColumnName(cfg.excel_column_name as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [commodityId, tickerRoot, config]);

  useEffect(() => { load(); }, [load]);

  // ─── Save mapping ─────────────────────────────────────────────────────
  async function handleSaveMapping() {
    if (!selectedProviderId) return;
    setSaving(true);
    setError(null);
    try {
      // Save symbol map
      await apiFetch("/api/market/symbol-map", {
        method: "POST",
        body: JSON.stringify({
          providerId: selectedProviderId,
          commodityId,
          providerSymbol,
          providerRoot: providerSymbol,
        }),
      });

      // Save config on commodity
      await apiFetch(`/api/kernel/commodities/${commodityId}`, {
        method: "PUT",
        body: JSON.stringify({
          config: {
            mtm_price_type: mtmPriceType,
            excel_column_name: excelColumnName,
          },
        }),
      });

      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Compute previous prices for change column ────────────────────────
  // We don't have prev-day data in this response; show change = 0 for now
  // In a real setup, the board endpoint handles this.

  // ─── Build combined price rows (with missing months) ──────────────────
  const allRows: { month: string; price: PriceRow | null }[] = [];
  if (latestData) {
    const priceMap = new Map(latestData.prices.map((p) => [p.contract_month, p]));
    const allMonths = new Set([
      ...latestData.expectedMonths,
      ...latestData.prices.map((p) => p.contract_month),
    ]);
    const sorted = Array.from(allMonths).sort();
    for (const m of sorted) {
      allRows.push({ month: m, price: priceMap.get(m) ?? null });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-faint text-sm">
        Loading market data...
      </div>
    );
  }

  return (
    <div className="flex gap-5">
      {/* ═══ LEFT SIDE ═══ */}
      <div className="flex-1 space-y-5">
        {error && (
          <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>
        )}

        {/* Card 1: Price Source Mapping */}
        <div className="bg-surface border border-b-default rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Price Source Mapping
            </h4>
            <button
              onClick={handleSaveMapping}
              disabled={saving || !selectedProviderId}
              className={btnPrimary}
            >
              {saving ? "Saving..." : "Save Mapping"}
            </button>
          </div>

          {providers.length === 0 ? (
            <div className="text-sm text-muted">
              No providers configured.{" "}
              <Link href="/settings" className="text-action hover:text-action-hover transition-colors">
                Go to Settings → Market Data
              </Link>{" "}
              to add one.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">Provider</span>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select provider...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.provider_type})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">Provider Symbol</span>
                <div className="flex">
                  <input
                    value={providerSymbol}
                    onChange={(e) => setProviderSymbol(e.target.value.toUpperCase())}
                    className={cn(inputCls, "font-mono rounded-r-none")}
                    placeholder="ZC"
                  />
                  <span className="inline-flex items-center px-3 bg-input-bg border border-l-0 border-b-input rounded-r-md text-xs text-faint">
                    root
                  </span>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">Price Type for MTM</span>
                <select
                  value={mtmPriceType}
                  onChange={(e) => setMtmPriceType(e.target.value)}
                  className={selectCls}
                >
                  <option value="settlement">Settlement</option>
                  <option value="close">Close</option>
                  <option value="last">Last</option>
                  <option value="vwap">VWAP</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">Excel Column Name</span>
                <input
                  value={excelColumnName}
                  onChange={(e) => setExcelColumnName(e.target.value.toUpperCase())}
                  className={cn(inputCls, "font-mono")}
                  placeholder="CORN"
                />
                <p className="text-[10px] text-faint mt-0.5">
                  Must match the &apos;commodity&apos; column in the Excel upload template
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Card 2: Latest Prices */}
        <div className="bg-surface border border-b-default rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Latest Prices
            </h4>
            {latestData?.prices?.[0]?.price_date && (
              <span className="text-[10px] text-faint">
                Last updated: {new Date(latestData.prices[0].price_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {allRows.length === 0 ? (
            <p className="text-sm text-faint py-4 text-center">
              No price data available for this commodity.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-b-default/50">
                    {["Contract", "Settle", "Change", "Volume", "OI", "Source"].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider",
                          h === "Contract" || h === "Source" ? "text-left" : "text-right"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map(({ month, price }) => (
                    <tr
                      key={month}
                      className="border-b border-b-default/50 hover:bg-overlay transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-action">
                        {formatContractMonth(month)}
                      </td>
                      {price ? (
                        <>
                          <td className="px-3 py-2 text-right font-mono text-secondary tabular-nums">
                            {Number(price.price).toFixed(priceDecimalPlaces)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ChangeCell current={Number(price.price)} previous={null} />
                          </td>
                          <td className="px-3 py-2 text-right text-secondary tabular-nums">
                            {price.volume ? Number(price.volume).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-secondary tabular-nums">
                            {price.open_interest ? Number(price.open_interest).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <SourceBadge source={price.source} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right text-faint">—</td>
                          <td className="px-3 py-2 text-right text-faint">—</td>
                          <td className="px-3 py-2 text-right text-faint">—</td>
                          <td className="px-3 py-2 text-right text-faint">—</td>
                          <td className="px-3 py-2">
                            <SourceBadge source="missing" />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT SIDE (Sidebar) ═══ */}
      <div className="w-[280px] shrink-0 space-y-4">
        {/* Card 1: Price Status */}
        <div className="bg-surface border border-b-default rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Price Status</h4>
          <div className="space-y-2 text-sm">
            <KV label="Provider" value={status?.provider ?? "Not configured"} />
            <KV label="Last update" value={formatRelativeTime(status?.lastUpdate)} />
            <KV
              label="Contracts priced"
              value={
                status
                  ? `${status.contractsPriced} of ${status.totalContracts}`
                  : "—"
              }
              valueClass={
                status
                  ? status.contractsPriced === status.totalContracts && status.totalContracts > 0
                    ? "text-profit"
                    : status.contractsPriced === 0
                      ? "text-destructive"
                      : "text-swap"
                  : undefined
              }
            />
            <KV
              label="History depth"
              value={
                status?.historyDays
                  ? `${status.historyDays.toLocaleString()} days`
                  : "—"
              }
            />
            <KV label="Earliest date" value={status?.earliestDate ?? "—"} />
          </div>
        </div>

        {/* Card 2: MTM Impact */}
        <div className="bg-surface border border-b-default rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">MTM Impact</h4>
          <div className="space-y-2 text-sm">
            <KV label="Open positions" value={mtmCoverage?.openPositions?.toString() ?? "0"} />
            <KV label="Positions with price" value={mtmCoverage?.withPrice?.toString() ?? "0"} />
            <KV
              label="Missing price"
              value={
                mtmCoverage?.missingPrice
                  ? `${mtmCoverage.missingPrice}${
                      mtmCoverage.missingMonths.length > 0
                        ? ` (${mtmCoverage.missingMonths.map(formatContractMonth).join(", ")})`
                        : ""
                    }`
                  : "0"
              }
              valueClass={mtmCoverage?.missingPrice ? "text-destructive" : undefined}
            />
          </div>
          {mtmCoverage && mtmCoverage.missingPrice > 0 && (
            <p className="text-[10px] text-faint mt-2">
              Missing prices will block MTM for those contract months.
            </p>
          )}
        </div>

        {/* Card 3: Quick Actions */}
        <div className="bg-surface border border-b-default rounded-lg p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Quick Actions</h4>
          <QuickActionLink
            href={`/market?tab=upload&commodity=${commodityId}`}
            label={`Upload prices for ${commodityName}`}
          />
          <QuickActionLink
            href={`/market?tab=curves&commodity=${commodityId}`}
            label="View forward curve"
          />
          <QuickActionLink
            href={`/risk?commodity=${commodityId}&action=mtm`}
            label="Run MTM"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function KV({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("text-xs font-medium", valueClass ?? "text-secondary")}>
        {value}
      </span>
    </div>
  );
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between w-full px-3 py-2 text-xs text-action bg-action-5 border border-action-20 rounded-md hover:bg-action-10 transition-colors cursor-pointer"
    >
      <span>{label}</span>
      <span className="text-sm">→</span>
    </Link>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}
