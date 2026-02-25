"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Trade, DeliverySchedule } from "@/types/trade";
import type { AuditLog, Page } from "@/types/audit";
import { ArrowLeft, Edit } from "lucide-react";

const deliveryStatusStyle: Record<string, string> = {
  COMPLETE:  "bg-profit-10 text-profit",
  PARTIAL:   "bg-warning-10 text-warning",
  CANCELLED: "bg-destructive-10 text-destructive",
};

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tradeId = Number(id);
  const [tab, setTab] = useState<"details" | "deliveries" | "amendments">("details");

  const { data: trade } = useSWR<Trade>(`/api/v1/trades/${tradeId}`, (u: string) => api.get<Trade>(u));
  const { data: deliveries } = useSWR<DeliverySchedule[]>(
    `/api/v1/deliveries/trade/${tradeId}`,
    (u: string) => api.get<DeliverySchedule[]>(u)
  );
  const { data: amendments } = useSWR<Page<AuditLog>>(
    tab === "amendments" ? `/api/v1/trades/${tradeId}/amendments?size=20` : null,
    (u: string) => api.get<Page<AuditLog>>(u)
  );

  if (!trade) return <div className="text-faint p-6 text-sm">Loading\u2026</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Trades
        </Link>
        <h1 className="text-xl font-bold text-primary font-mono">{trade.tradeReference}</h1>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-profit-10 text-profit ring-1 ring-profit-20">
          {trade.status.replace(/_/g, " ")}
        </span>
        {(trade.status === "CONFIRMED" || trade.status === "AMENDED") && (
          <Link
            href={`/trades/${tradeId}/amend`}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm bg-action hover:bg-action-hover text-white rounded-lg transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Amend Trade
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-b-default flex gap-6">
        {(["details", "deliveries", "amendments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-action text-action"
                : "border-transparent text-faint hover:text-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {[
            ["Type",          trade.tradeType.replace(/_/g, " ")],
            ["Counterparty",  trade.counterpartyName],
            ["Commodity",     trade.commodityCode],
            ["Book",          trade.bookCode],
            ["Trade Date",    trade.tradeDate],
            ["Start Date",    trade.startDate],
            ["End Date",      trade.endDate],
            ["Quantity",      `${trade.quantity} ${trade.quantityUnit ?? ""}`],
            ["Pricing",       trade.pricingType],
            ["Fixed Price",   trade.fixedPrice ?? "\u2014"],
            ["Price Index",   trade.priceIndexCode ?? "\u2014"],
            ["Spread",        trade.spread],
            ["Currency",      trade.currency],
            ["Notional USD",  trade.notionalUsd ? `$${Number(trade.notionalUsd).toLocaleString()}` : "\u2014"],
            ["MtM USD",       trade.mtmValueUsd ? `$${Number(trade.mtmValueUsd).toLocaleString()}` : "\u2014"],
            ["Unrealized P&L",trade.unrealizedPnlUsd ? `$${Number(trade.unrealizedPnlUsd).toLocaleString()}` : "\u2014"],
            ["Amendments",    String(trade.amendmentCount ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-faint uppercase tracking-wide">{label}</dt>
              <dd className="mt-0.5 text-secondary">{value}</dd>
            </div>
          ))}
        </div>
      )}

      {tab === "deliveries" && (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-input-bg/50 border-b border-b-default">
              <tr>
                {["Month", "Scheduled Qty", "Delivered Qty", "Status", "Location"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {deliveries?.length ? deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 font-mono text-secondary">{d.deliveryMonth}</td>
                  <td className="px-4 py-2.5 text-secondary">{d.scheduledQuantity}</td>
                  <td className="px-4 py-2.5 text-secondary">{d.deliveredQuantity}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      deliveryStatusStyle[d.status] ?? "bg-hover text-muted"
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-faint">{d.deliveryLocation ?? "\u2014"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-faint">No delivery schedules</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "amendments" && (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-input-bg/50 border-b border-b-default">
              <tr>
                {["When", "By", "Action", "Summary"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {amendments?.content.length ? amendments.content.map((a) => (
                <tr key={a.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 text-xs font-mono text-muted">
                    {new Date(a.performedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-secondary">{a.performedBy}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-action-10 text-action">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-faint">{a.changeSummary}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-faint">No amendment history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
