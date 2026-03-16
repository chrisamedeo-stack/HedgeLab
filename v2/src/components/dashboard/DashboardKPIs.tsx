"use client";

import { KPICard } from "@/components/ui/KPICard";
import type { DashboardKpis } from "@/types/dashboard";

interface Props {
  kpis: DashboardKpis | null;
  loading: boolean;
}

export function DashboardKPIs({ kpis, loading }: Props) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-b-default rounded-lg p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
            <div className="h-7 w-16 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  const pnl = kpis?.totalPnl ?? 0;
  const coverage = kpis?.coveragePct ?? 0;
  const hedged = kpis?.hedgedVolume ?? 0;
  const net = kpis?.netPosition ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Total P&L"
        value={`$${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        valueClassName={pnl >= 0 ? "text-profit" : "text-loss"}
        subtitle={pnl >= 0 ? "Profit" : "Loss"}
        trend={pnl > 0 ? "up" : pnl < 0 ? "down" : "neutral"}
      />
      <KPICard
        label="Coverage"
        value={`${coverage}%`}
        valueClassName={coverage >= 80 ? "text-profit" : coverage >= 50 ? "text-warning" : "text-loss"}
        subtitle={`${kpis?.coveredVolume?.toLocaleString() ?? 0} / ${kpis?.budgetedVolume?.toLocaleString() ?? 0}`}
      />
      <KPICard
        label="Hedged Volume"
        value={hedged.toLocaleString()}
        subtitle={`${(kpis?.openVolume ?? 0).toLocaleString()} open · ${(kpis?.lockedVolume ?? 0).toLocaleString()} locked`}
      />
      <KPICard
        label="Net Position"
        value={Math.abs(net).toLocaleString()}
        subtitle={net > 0 ? "Net Long" : net < 0 ? "Net Short" : "Flat"}
        trend={net > 0 ? "up" : net < 0 ? "down" : "neutral"}
      />
    </div>
  );
}
