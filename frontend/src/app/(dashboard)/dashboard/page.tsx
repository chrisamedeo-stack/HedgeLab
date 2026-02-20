"use client";

import Link from "next/link";
import { ArrowLeftRight, ShieldAlert, DollarSign, Activity, type LucideIcon } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useCreditAlerts } from "@/hooks/useRiskMetrics";
import { StatusBadge } from "@/components/ui/Badge";
import { SkeletonTable, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { trades, isLoading: tradesLoading } = useTrades(0, 5, "CONFIRMED");
  const { alerts, isLoading: alertsLoading } = useCreditAlerts();

  const redAlerts   = alerts.filter((a) => a.alertLevel === "RED");
  const amberAlerts = alerts.filter((a) => a.alertLevel === "AMBER");

  const totalNotional = trades?.content.reduce(
    (sum, t) => sum + (t.notionalUsd ? parseFloat(t.notionalUsd) : 0),
    0
  ) ?? 0;

  const isLoading = tradesLoading || alertsLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Open Trades"
            value={String(trades?.totalElements ?? 0)}
            icon={ArrowLeftRight}
            href="/trades"
          />
          <KpiCard
            label="Credit Alerts"
            value={`${redAlerts.length} RED / ${amberAlerts.length} AMBER`}
            icon={ShieldAlert}
            href="/risk"
            highlight={redAlerts.length > 0 ? "red" : amberAlerts.length > 0 ? "amber" : undefined}
          />
          <KpiCard
            label="Total Notional"
            value={formatUsd(totalNotional, true)}
            icon={DollarSign}
            href="/trades"
          />
          <KpiCard
            label="Risk Status"
            value={`${alerts.length} metrics today`}
            icon={Activity}
            href="/risk"
          />
        </div>
      )}

      {/* Recent Trades */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Recent Confirmed Trades
          </h2>
          <Link href="/trades" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  {["Reference", "Type", "Counterparty", "Commodity", "Notional USD", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {trades?.content.length ? (
                  trades.content.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/trades/${t.id}`}
                          className="text-blue-400 hover:text-blue-300 font-mono text-xs transition-colors"
                        >
                          {t.tradeReference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {t.tradeType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{t.counterpartyName}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{t.commodityCode}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                        {formatUsd(t.notionalUsd)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={ArrowLeftRight}
                        title="No confirmed trades"
                        description="Confirmed trades will appear here once available."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Credit Alert banners */}
      {!isLoading && (redAlerts.length + amberAlerts.length) > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Credit Alerts
          </h2>
          <div className="space-y-2">
            {[...redAlerts, ...amberAlerts].map((a) => (
              <div
                key={a.counterpartyId}
                className={cn(
                  "rounded-xl border p-4",
                  a.alertLevel === "RED"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      a.alertLevel === "RED" ? "text-red-300" : "text-amber-300"
                    )}>
                      {a.counterpartyName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatUsd(a.utilizedAmount)} / {formatUsd(a.creditLimit)}
                    </p>
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    a.alertLevel === "RED" ? "text-red-400" : "text-amber-400"
                  )}>
                    {formatPct(a.utilizationPct)} {a.alertLevel}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      a.alertLevel === "RED" ? "bg-red-500" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(100, a.utilizationPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  highlight?: "red" | "amber";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bg-slate-900 border border-slate-800 rounded-xl p-5 block hover:border-slate-700 transition-colors group",
        highlight === "red" && "border-red-500/30 bg-red-500/5",
        highlight === "amber" && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <Icon
          className={cn(
            "h-4 w-4",
            highlight === "red"
              ? "text-red-400"
              : highlight === "amber"
              ? "text-amber-400"
              : "text-slate-600 group-hover:text-slate-400 transition-colors"
          )}
        />
      </div>
      <p className={cn(
        "text-2xl font-bold",
        highlight === "red"
          ? "text-red-300"
          : highlight === "amber"
          ? "text-amber-300"
          : "text-slate-100"
      )}>
        {value}
      </p>
    </Link>
  );
}
