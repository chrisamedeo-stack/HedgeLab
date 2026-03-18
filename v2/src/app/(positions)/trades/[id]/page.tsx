"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTrade } from "@/hooks/useTrades";
import { useCommodities } from "@/hooks/usePositions";
import { useAuth } from "@/contexts/AuthContext";
import { TabGroup } from "@/components/ui/TabGroup";
import { Spinner } from "@/components/ui/Spinner";
import { API_BASE } from "@/lib/api";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { SwapSettlement, SwapDetails, OptionDetails, FuturesDetails } from "@/types/trades";

const statusStyle: Record<string, string> = {
  open: "bg-profit-10 text-profit",
  partially_allocated: "bg-warning-10 text-warning",
  fully_allocated: "bg-action-10 text-action",
  rolled: "bg-accent-10 text-accent",
  cancelled: "bg-destructive-10 text-destructive",
};

const typeStyle: Record<string, { bg: string; text: string }> = {
  futures: { bg: "bg-futures-15", text: "text-futures" },
  options: { bg: "bg-action-10", text: "text-action" },
  swap: { bg: "bg-swap-15", text: "text-swap" },
};

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-faint uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-secondary">{value ?? "—"}</dd>
    </div>
  );
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tradeData, loading, error, refetch } = useTrade(id);
  const { user } = useAuth();
  const { data: commodities } = useCommodities();

  const trade = tradeData?.trade;
  const isSwap = trade?.trade_type === "swap";

  const tabs = [
    { key: "details", label: "Details" },
    ...(isSwap ? [{ key: "settlements", label: "Settlement Schedule" }] : []),
  ];

  const [tab, setTab] = useState("details");

  // Swap settlements state
  const [settlements, setSettlements] = useState<SwapSettlement[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [settleRowId, setSettleRowId] = useState<string | null>(null);
  const [floatingPrice, setFloatingPrice] = useState("");
  const [settling, setSettling] = useState(false);

  const fetchSettlements = useCallback(async () => {
    if (!id || !isSwap) return;
    setSettlementsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/trades/${id}/settlements`);
      if (res.ok) {
        setSettlements(await res.json());
      }
    } catch {
      // silent
    } finally {
      setSettlementsLoading(false);
    }
  }, [id, isSwap]);

  useEffect(() => {
    if (isSwap && tab === "settlements") {
      fetchSettlements();
    }
  }, [isSwap, tab, fetchSettlements]);

  const handleSettle = async (settlementId: string) => {
    if (!floatingPrice || !user) return;
    setSettling(true);
    try {
      const res = await fetch(`${API_BASE}/api/trades/${id}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId, floatingPrice: Number(floatingPrice), userId: user.id }),
      });
      if (res.ok) {
        setSettleRowId(null);
        setFloatingPrice("");
        fetchSettlements();
        refetch();
      }
    } catch {
      // silent
    } finally {
      setSettling(false);
    }
  };

  if (loading || !tradeData || !trade) {
    return (
      <div className="space-y-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Trades
        </Link>
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      </div>
    );
  }

  const style = typeStyle[trade.trade_type] ?? typeStyle.futures;
  const tradeCommodity = commodities?.find((c) => c.id === trade.commodity_id);
  const priceUnit = tradeCommodity?.price_unit ?? "";

  // Instrument-specific details
  const details = trade.details;
  const futuresDetails = details?.type === "futures" ? details as FuturesDetails : null;
  const optionDetails = details?.type === "options" ? details as OptionDetails : null;
  const swapDetails = details?.type === "swap" ? details as SwapDetails : null;

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Trades
        </Link>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider font-mono">
          {trade.external_ref || trade.id.slice(0, 8)}
        </h1>
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
          {trade.trade_type === "futures" ? "Futures" : trade.trade_type === "options" ? "Options" : "Swap"}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[trade.status] ?? "bg-hover text-muted"}`}>
          {trade.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={tabs}
        active={tab}
        onChange={(key) => setTab(key)}
      />

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {/* ─── Details Tab ────────────────────────────────────────────── */}
      {tab === "details" && (
        <div className="space-y-6">
          {/* Common fields */}
          <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <DetailField label="Type" value={trade.trade_type} />
            <DetailField label="Instrument Class" value={trade.instrument_class?.replace(/_/g, " ")} />
            <DetailField label="Direction" value={trade.direction} />
            <DetailField label="Commodity" value={trade.commodity_name ?? trade.commodity_id} />
            <DetailField label="Trade Date" value={trade.trade_date?.slice(0, 10)} />
            <DetailField label="Contract Month" value={formatContractMonth(trade.contract_month)} />
            <DetailField label="Contracts" value={String(trade.num_contracts)} />
            <DetailField label="Contract Size" value={String(trade.contract_size)} />
            <DetailField label="Total Volume" value={Number(trade.total_volume).toLocaleString()} />
            <DetailField label="Trade Price" value={trade.trade_price != null ? `$${Number(trade.trade_price).toFixed(4)}${priceUnit ? `/${priceUnit}` : ""}` : null} />
            <DetailField label="Currency" value={trade.currency} />
            <DetailField label="Commission" value={trade.commission != null ? `$${Number(trade.commission).toFixed(2)}` : null} />
            <DetailField label="Fees" value={trade.fees != null ? `$${Number(trade.fees).toFixed(2)}` : null} />
            {!isSwap && (
              <>
                <DetailField label="Allocated Volume" value={`${Number(trade.allocated_volume).toLocaleString()} / ${Number(trade.total_volume).toLocaleString()}`} />
                <DetailField label="Unallocated" value={Number(trade.unallocated_volume).toLocaleString()} />
              </>
            )}
            <DetailField label="External Ref" value={trade.external_ref} />
            <DetailField label="Notes" value={trade.notes} />
            <DetailField label="Created" value={new Date(trade.created_at).toLocaleString()} />
          </div>

          {/* Futures-specific details */}
          {futuresDetails && (
            <div>
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">Futures Details</h3>
              <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DetailField label="Exchange" value={futuresDetails.exchange} />
                <DetailField label="Broker" value={futuresDetails.broker} />
                <DetailField label="Account" value={futuresDetails.accountNumber} />
                <DetailField label="Contract Month" value={formatContractMonth(futuresDetails.contractMonth)} />
                <DetailField label="Contracts" value={String(futuresDetails.numContracts)} />
                <DetailField label="Contract Size" value={String(futuresDetails.contractSize)} />
              </div>
            </div>
          )}

          {/* Options-specific details */}
          {optionDetails && (
            <div>
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">Options Details</h3>
              <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DetailField label="Option Type" value={optionDetails.optionType === "call" ? "Call" : "Put"} />
                <DetailField label="Style" value={optionDetails.optionStyle === "american" ? "American" : "European"} />
                <DetailField label="Strike Price" value={`$${Number(optionDetails.strikePrice).toFixed(4)}`} />
                <DetailField label="Premium" value={`$${Number(optionDetails.premium).toFixed(4)}`} />
                {optionDetails.premiumTotal != null && (
                  <DetailField label="Total Premium" value={`$${Number(optionDetails.premiumTotal).toFixed(2)}`} />
                )}
                <DetailField label="Expiration" value={optionDetails.expirationDate?.slice(0, 10)} />
                <DetailField label="Exercise Status" value={optionDetails.exerciseStatus?.replace(/_/g, " ")} />
                <DetailField label="Underlying Contract" value={formatContractMonth(optionDetails.underlyingContract)} />
                <DetailField label="Exchange" value={optionDetails.exchange} />
                <DetailField label="Broker" value={optionDetails.broker} />
                <DetailField label="Account" value={optionDetails.accountNumber} />
              </div>
            </div>
          )}

          {/* Swap-specific details */}
          {swapDetails && (
            <div>
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">Swap Details</h3>
              <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DetailField label="Counterparty" value={trade.counterparty_name} />
                <DetailField label="Swap Type" value={swapDetails.swapType?.replace(/_/g, " ")} />
                <DetailField label="Fixed Price" value={`$${Number(swapDetails.fixedPrice).toFixed(4)}`} />
                <DetailField label="Floating Reference" value={swapDetails.floatingReference} />
                {swapDetails.floatingIndex && <DetailField label="Floating Index" value={swapDetails.floatingIndex} />}
                <DetailField label="Notional Volume" value={`${Number(swapDetails.notionalVolume).toLocaleString()} ${swapDetails.volumeUnit ?? ""}`} />
                <DetailField label="Start Date" value={swapDetails.startDate?.slice(0, 10)} />
                <DetailField label="End Date" value={swapDetails.endDate?.slice(0, 10)} />
                <DetailField label="Payment Frequency" value={swapDetails.paymentFrequency?.replace(/_/g, " ")} />
                <DetailField label="Settlement Type" value={swapDetails.settlementType} />
                {swapDetails.isdaRef && <DetailField label="ISDA Ref" value={swapDetails.isdaRef} />}
                {swapDetails.masterAgreement && <DetailField label="Master Agreement" value={swapDetails.masterAgreement} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Settlements Tab (Swap only) ────────────────────────────── */}
      {tab === "settlements" && isSwap && (
        <div className="space-y-4">
          {settlementsLoading ? (
            <div className="py-8 text-center"><Spinner /></div>
          ) : settlements.length === 0 ? (
            <div className="bg-surface border border-b-default rounded-lg p-6 text-center text-sm text-faint">
              No settlement periods generated yet.
            </div>
          ) : (
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-input-bg/50 border-b border-b-default">
                  <tr>
                    {["Period", "Start", "End", "Fixed", "Floating", "Volume", "P&L", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {settlements.map((s, i) => {
                    const pnl = s.settlement_amount != null ? Number(s.settlement_amount) : null;
                    const isSettling = settleRowId === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-row-hover">
                        <td className="px-4 py-2.5 tabular-nums text-secondary">{i + 1}</td>
                        <td className="px-4 py-2.5 tabular-nums text-muted">{s.settlement_period_start?.slice(0, 10)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-muted">{s.settlement_period_end?.slice(0, 10)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-secondary">${Number(s.fixed_price).toFixed(4)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-secondary">
                          {s.floating_price != null ? `$${Number(s.floating_price).toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-secondary">{Number(s.volume).toLocaleString()}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {pnl != null ? (
                            <span className={pnl >= 0 ? "text-profit" : "text-loss"}>
                              {pnl >= 0 ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.status === "settled" ? "bg-profit-10 text-profit"
                              : s.status === "disputed" ? "bg-destructive-10 text-destructive"
                              : "bg-warning-10 text-warning"
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {s.status === "pending" && !isSettling && (
                            <button
                              onClick={() => { setSettleRowId(s.id); setFloatingPrice(""); }}
                              className="rounded bg-action px-2.5 py-1 text-xs text-white hover:bg-action-hover"
                            >
                              Settle
                            </button>
                          )}
                          {isSettling && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                value={floatingPrice}
                                onChange={(e) => setFloatingPrice(e.target.value)}
                                placeholder="Floating price"
                                className="w-28 rounded border border-b-input bg-input-bg px-2 py-1 text-xs text-primary tabular-nums focus:border-focus focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSettle(s.id)}
                                disabled={settling || !floatingPrice}
                                className="rounded bg-profit px-2 py-1 text-xs text-white hover:bg-profit/80 disabled:opacity-50"
                              >
                                {settling ? "..." : "OK"}
                              </button>
                              <button
                                onClick={() => setSettleRowId(null)}
                                className="text-xs text-faint hover:text-secondary"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Settlement summary */}
              {settlements.some((s) => s.status === "settled") && (
                <div className="border-t border-b-default px-4 py-3 flex items-center gap-6 text-xs">
                  <span className="text-faint">
                    Settled: {settlements.filter((s) => s.status === "settled").length} / {settlements.length}
                  </span>
                  <span className="text-secondary font-medium tabular-nums">
                    Total P&L:{" "}
                    {(() => {
                      const total = settlements
                        .filter((s) => s.settlement_amount != null)
                        .reduce((sum, s) => sum + Number(s.settlement_amount), 0);
                      return (
                        <span className={total >= 0 ? "text-profit" : "text-loss"}>
                          {total >= 0 ? "+" : ""}${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      );
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
