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
  COMPLETE:  "bg-emerald-500/10 text-emerald-400",
  PARTIAL:   "bg-amber-500/10 text-amber-400",
  CANCELLED: "bg-red-500/10 text-red-400",
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

  if (!trade) return <div className="text-slate-500 p-6 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Trades
        </Link>
        <h1 className="text-xl font-bold text-slate-100 font-mono">{trade.tradeReference}</h1>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          {trade.status.replace(/_/g, " ")}
        </span>
        {(trade.status === "CONFIRMED" || trade.status === "AMENDED") && (
          <Link
            href={`/trades/${tradeId}/amend`}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Amend Trade
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-6">
        {(["details", "deliveries", "amendments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
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
            ["Fixed Price",   trade.fixedPrice ?? "—"],
            ["Price Index",   trade.priceIndexCode ?? "—"],
            ["Spread",        trade.spread],
            ["Currency",      trade.currency],
            ["Notional USD",  trade.notionalUsd ? `$${Number(trade.notionalUsd).toLocaleString()}` : "—"],
            ["MtM USD",       trade.mtmValueUsd ? `$${Number(trade.mtmValueUsd).toLocaleString()}` : "—"],
            ["Unrealized P&L",trade.unrealizedPnlUsd ? `$${Number(trade.unrealizedPnlUsd).toLocaleString()}` : "—"],
            ["Amendments",    String(trade.amendmentCount ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
              <dd className="mt-0.5 text-slate-200">{value}</dd>
            </div>
          ))}
        </div>
      )}

      {tab === "deliveries" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                {["Month", "Scheduled Qty", "Delivered Qty", "Status", "Location"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {deliveries?.length ? deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono text-slate-300">{d.deliveryMonth}</td>
                  <td className="px-4 py-2.5 text-slate-300">{d.scheduledQuantity}</td>
                  <td className="px-4 py-2.5 text-slate-300">{d.deliveredQuantity}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      deliveryStatusStyle[d.status] ?? "bg-slate-700 text-slate-400"
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{d.deliveryLocation ?? "—"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No delivery schedules</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "amendments" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                {["When", "By", "Action", "Summary"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {amendments?.content.length ? amendments.content.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-400">
                    {new Date(a.performedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{a.performedBy}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{a.changeSummary}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No amendment history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
