"use client";

import { useState } from "react";
import { WIDGET_MAP } from "@/lib/widgetRegistry";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { WidgetLayoutEntry, DrillLevel, UnitSummary, SiteSummary } from "@/types/dashboard";
import type { DashboardSummary } from "@/store/dashboardStore";
import type { RolloverCandidate, BasisSummary } from "@/types/positions";
import type { MtmSummary, MtmSnapshot, PnlAttribution } from "@/types/risk";

import { KPICard } from "@/components/ui/KPICard";
import { CoverageWaterfallChart } from "@/components/charts/CoverageWaterfallChart";
import { CoverageMiniChart } from "@/components/charts/CoverageMiniChart";
import { PositionByMonthChart } from "@/components/charts/PositionByMonthChart";
import { ExpiringPositionsCard } from "@/components/charts/ExpiringPositionsCard";
import { PositionLifecycleFunnel } from "@/components/charts/PositionLifecycleFunnel";
import { DailyPnlTrendChart } from "@/components/charts/DailyPnlTrendChart";
import { PnlByCommodityChart } from "@/components/charts/PnlByCommodityChart";
import { ForwardCurveChart } from "@/components/charts/ForwardCurveChart";
import { BasisBySiteChart } from "@/components/charts/BasisBySiteChart";
import { BasisByMonthChart } from "@/components/charts/BasisByMonthChart";
import { PnlWaterfallChart } from "@/components/charts/PnlWaterfallChart";
import { OrgUnitCardGrid } from "@/components/dashboard/OrgUnitCardGrid";
import { SiteCardGrid } from "@/components/dashboard/SiteCardGrid";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import Link from "next/link";

// Icon helper
const Icon = ({ d, size = "h-4 w-4" }: { d: string; size?: string }) => (
  <svg className={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  stack: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z",
  lock: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  exclamation: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  currency: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  trendUp: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  arrowPath: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182",
};

// ─── Underhedged Months Card ──────────────────────────────────────────────

function UnderhedgedMonthsCard({ data }: { data: { month: string; budgeted: number; hedged: number; committed: number; coveragePct: number }[] }) {
  const underhedged = data
    .filter((d) => d.coveragePct < 100 && d.budgeted > 0)
    .sort((a, b) => a.coveragePct - b.coveragePct)
    .slice(0, 5);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Top Underhedged Months</h2>
      {underhedged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6">
          <Icon d={ICONS.check} size="h-5 w-5" />
          <span className="mt-2 text-xs text-faint">All months fully covered</span>
        </div>
      ) : (
        <div className="space-y-3">
          {underhedged.map((m) => {
            const pct = m.coveragePct;
            const color = pct < 30 ? "bg-loss" : pct < 60 ? "bg-warning" : "bg-action";
            return (
              <div key={m.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-secondary font-mono">{formatContractMonth(m.month)}</span>
                  <span className={`text-xs font-semibold tabular-nums ${pct < 30 ? "text-loss" : pct < 60 ? "text-warning" : "text-muted"}`}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-input-bg overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent Trades Card ───────────────────────────────────────────────────

function RecentTradesCard({ trades }: { trades: { id: string; direction: string; commodity_name?: string; contract_month: string; total_volume: number; trade_price: number; trade_date: string }[] }) {
  const recent = trades.slice(0, 5);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Recent Trades</h2>
        <Link href="/trades" className="text-[11px] font-medium text-action hover:underline">View All</Link>
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Icon d="M12 4v16m8-8H4" size="h-5 w-5" />
          <span className="mt-2 text-xs text-faint">No trades booked yet</span>
          <Link href="/trades" className="mt-1 text-xs text-action hover:underline">Book your first trade</Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {recent.map((t) => {
            const isLong = t.direction === "long";
            return (
              <Link
                key={t.id}
                href={`/trades/${t.id}`}
                className="flex items-center gap-3 rounded border border-b-default bg-input-bg px-3 py-2 hover:bg-hover transition-colors group"
              >
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isLong ? "bg-profit-10 text-profit" : "bg-loss-10 text-loss"}`}>
                  {t.direction}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-secondary truncate">{t.commodity_name ?? "—"}</span>
                    <span className="text-[11px] font-mono text-faint">{formatContractMonth(t.contract_month)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] tabular-nums text-muted">{Number(t.total_volume).toLocaleString()}</span>
                    <span className="text-[11px] text-faint">@</span>
                    <span className="text-[11px] tabular-nums text-muted">${Number(t.trade_price).toFixed(2)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-faint tabular-nums">
                  {new Date(t.trade_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Risk Empty State ─────────────────────────────────────────────────────

function RiskEmptyState() {
  return (
    <div className="rounded-lg border border-b-default bg-surface px-6 py-8 text-center">
      <svg className="mx-auto h-6 w-6 text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.trendUp} />
      </svg>
      <p className="text-xs font-medium text-secondary mb-1">Risk analytics not yet available</p>
      <p className="text-[11px] text-faint mb-4">Run MTM to generate P&L data.</p>
      <Link href="/risk" className="rounded bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action-hover transition-colors">
        Go to Risk
      </Link>
    </div>
  );
}

// ─── Site Monthly Detail ──────────────────────────────────────────────────

function SiteMonthlyDetail({ siteId, orgId }: { siteId: string; orgId: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Monthly Detail</h2>
      <p className="text-xs text-faint">
        Month-by-month positions.{" "}
        <Link href={`/sites/${siteId}`} className="text-action hover:underline">Open site view</Link>
      </p>
    </div>
  );
}

function SiteAllInSummary({ siteId, orgId }: { siteId: string; orgId: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">All-In Summary</h2>
      <p className="text-xs text-faint">
        All-in pricing for this site.{" "}
        <Link href={`/sites/${siteId}`} className="text-action hover:underline">Open site view</Link>
      </p>
    </div>
  );
}

// ─── Main WidgetRenderer ──────────────────────────────────────────────────

interface WidgetRendererProps {
  widgets: WidgetLayoutEntry[];
  drillLevel: DrillLevel;
  summary: DashboardSummary | null;
  unitSummaries: UnitSummary[];
  siteSummaries: SiteSummary[];
  summariesLoading: boolean;
  onDrillUnit: (id: string, name: string) => void;
  onDrillSite: (id: string, name: string) => void;
  riskSummary?: MtmSummary | null;
  riskHistory?: MtmSnapshot[] | null;
  attribution?: PnlAttribution[] | null;
  forwardCurve?: { current: { contract_month: string; price: number }[]; comparison: { contract_month: string; price: number }[] | null; compareDate: string | null } | null;
  onCurveCompareChange?: (date: string | undefined) => void;
  basisSummary?: BasisSummary | null;
  orgId: string;
  currentSiteId?: string;
  currentUnitId?: string;
  commodityId?: string;
}

export function WidgetRenderer({
  widgets, drillLevel, summary,
  unitSummaries, siteSummaries, summariesLoading,
  onDrillUnit, onDrillSite,
  riskSummary, riskHistory, attribution,
  forwardCurve, onCurveCompareChange,
  basisSummary,
  orgId, currentSiteId, currentUnitId, commodityId,
}: WidgetRendererProps) {
  const [curveCompareDate, setCurveCompareDate] = useState<string | undefined>();

  const kpis = summary?.hedgeBook?.kpis;
  const coverage = summary?.coverage ?? null;
  const coveragePct = coverage?.overallCoveragePct ?? 0;
  const totalBudgeted = coverage?.totalBudgeted ?? 0;
  const totalOpen = coverage?.totalOpen ?? 0;
  const totalOpenVolume = kpis?.openVolume ?? 0;
  const lockedVolume = kpis?.lockedVolume ?? 0;
  const openCount = kpis?.openCount ?? 0;
  const efpCount = kpis?.efpCount ?? 0;
  const rollCandidates = summary?.rollCandidates?.candidates ?? [];
  const criticalRolls = rollCandidates.filter((c: RolloverCandidate) => c.urgency === "CRITICAL");
  const trades = summary?.trades ?? [];
  const pendingApproval = summary?.pendingApproval ?? 0;
  const funnelTotal = totalOpenVolume + lockedVolume + (kpis?.offsetVolume ?? 0) + (kpis?.rolledVolume ?? 0);

  const rendered: React.ReactNode[] = [];
  let halfBuffer: { entry: WidgetLayoutEntry; node: React.ReactNode }[] = [];

  const flushHalves = () => {
    if (halfBuffer.length === 0) return;
    if (halfBuffer.length === 1) {
      rendered.push(
        <div key={`half-${halfBuffer[0].entry.widgetId}`} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {halfBuffer[0].node}
        </div>
      );
    } else {
      rendered.push(
        <div key={`half-${halfBuffer[0].entry.widgetId}-${halfBuffer[1].entry.widgetId}`} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {halfBuffer[0].node}
          {halfBuffer[1].node}
        </div>
      );
    }
    halfBuffer = [];
  };

  for (const entry of widgets) {
    const def = WIDGET_MAP.get(entry.widgetId);
    if (!def) continue;

    let node: React.ReactNode = null;

    switch (entry.widgetId) {
      case "kpi-coverage":
        flushHalves();
        node = (
          <div key={entry.widgetId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="Hedge Coverage"
              value={`${Number(coveragePct).toFixed(1)}%`}
              subtitle={`${Number(totalBudgeted).toLocaleString()} budgeted`}
              icon={<Icon d={ICONS.shield} />}
              valueClassName={Number(coveragePct) >= 80 ? "text-profit" : Number(coveragePct) >= 50 ? "text-warning" : "text-loss"}
              trend={Number(coveragePct) >= 80 ? "up" : Number(coveragePct) >= 50 ? "neutral" : "down"}
            />
            <KPICard label="Open Volume" value={totalOpenVolume.toLocaleString()} subtitle={`${openCount} open allocations`} icon={<Icon d={ICONS.stack} />} />
            <KPICard label="Locked Volume" value={lockedVolume.toLocaleString()} subtitle={`${efpCount} EFP positions`} icon={<Icon d={ICONS.lock} />} valueClassName="text-profit" trend="up" />
            <KPICard
              label="Unhedged Exposure"
              value={Number(totalOpen).toLocaleString()}
              subtitle={pendingApproval > 0 ? `${pendingApproval} pending approval` : "budget covered"}
              icon={<Icon d={ICONS.exclamation} />}
              valueClassName={Number(totalOpen) > 0 ? "text-warning" : "text-profit"}
              trend={Number(totalOpen) > 0 ? "down" : "up"}
            />
          </div>
        );
        rendered.push(node);
        continue;

      case "org-unit-cards":
        flushHalves();
        node = <OrgUnitCardGrid key={entry.widgetId} units={unitSummaries} loading={summariesLoading} onSelect={onDrillUnit} />;
        rendered.push(node);
        continue;

      case "site-cards":
        flushHalves();
        node = <SiteCardGrid key={entry.widgetId} sites={siteSummaries} loading={summariesLoading} onSelect={onDrillSite} />;
        rendered.push(node);
        continue;

      case "coverage-waterfall":
        flushHalves();
        if (coverage?.byMonth) {
          node = <CoverageWaterfallChart key={entry.widgetId} data={coverage.byMonth} />;
          rendered.push(node);
        }
        continue;

      case "coverage-mini":
        node = <CoverageMiniChart key={entry.widgetId} sites={summary?.coverageBySite ?? []} />;
        break;

      case "underhedged-months":
        node = <UnderhedgedMonthsCard key={entry.widgetId} data={coverage?.byMonth ?? []} />;
        break;

      case "expiring-positions":
        node = <ExpiringPositionsCard key={entry.widgetId} candidates={rollCandidates} />;
        break;

      case "lifecycle-funnel":
        node = (
          <PositionLifecycleFunnel
            key={entry.widgetId}
            total={funnelTotal}
            open={totalOpenVolume}
            locked={lockedVolume}
            offset={kpis?.offsetVolume ?? 0}
            rolled={kpis?.rolledVolume ?? 0}
          />
        );
        break;

      case "positions-by-month":
        flushHalves();
        node = <PositionByMonthChart key={entry.widgetId} data={summary?.positionsByMonth ?? []} />;
        rendered.push(node);
        continue;

      case "forward-curve":
        flushHalves();
        if (forwardCurve && commodityId) {
          node = (
            <ForwardCurveChart
              key={entry.widgetId}
              current={forwardCurve.current}
              comparison={forwardCurve.comparison}
              compareDate={forwardCurve.compareDate}
              onCompareChange={onCurveCompareChange ?? setCurveCompareDate}
            />
          );
          rendered.push(node);
        }
        continue;

      case "basis-charts":
        flushHalves();
        if (basisSummary && (basisSummary.bySite.length > 0 || basisSummary.byMonth.length > 0)) {
          node = (
            <div key={entry.widgetId} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <BasisBySiteChart data={basisSummary.bySite} />
              <BasisByMonthChart data={basisSummary.byMonth} />
            </div>
          );
          rendered.push(node);
        }
        continue;

      case "recent-trades":
        flushHalves();
        node = <RecentTradesCard key={entry.widgetId} trades={trades as unknown as { id: string; direction: string; commodity_name?: string; contract_month: string; total_volume: number; trade_price: number; trade_date: string }[]} />;
        rendered.push(node);
        continue;

      case "risk-kpis":
        flushHalves();
        if (!riskSummary) {
          node = <RiskEmptyState key={entry.widgetId} />;
        } else {
          node = (
            <div key={entry.widgetId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard label="Total MTM" value={`$${riskSummary.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Icon d={ICONS.currency} />} valueClassName={riskSummary.totalPnl >= 0 ? "text-profit" : "text-loss"} trend={riskSummary.totalPnl >= 0 ? "up" : "down"} />
              <KPICard label="Realized P&L" value={`$${riskSummary.realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Icon d={ICONS.check} />} valueClassName={riskSummary.realizedPnl >= 0 ? "text-profit" : "text-loss"} trend={riskSummary.realizedPnl >= 0 ? "up" : "down"} />
              <KPICard label="Unrealized P&L" value={`$${riskSummary.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Icon d={ICONS.trendUp} />} valueClassName={riskSummary.unrealizedPnl >= 0 ? "text-profit" : "text-loss"} trend={riskSummary.unrealizedPnl >= 0 ? "up" : "down"} />
              <KPICard label="Net Position" value={riskSummary.netPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })} subtitle={riskSummary.netPosition > 0 ? "Long" : riskSummary.netPosition < 0 ? "Short" : "Flat"} icon={<Icon d={ICONS.arrowPath} />} />
            </div>
          );
        }
        rendered.push(node);
        continue;

      case "daily-pnl":
        flushHalves();
        if (riskHistory) {
          node = <DailyPnlTrendChart key={entry.widgetId} data={riskHistory} />;
          rendered.push(node);
        }
        continue;

      case "pnl-waterfall":
        flushHalves();
        if (attribution && attribution.length > 0) {
          node = <PnlWaterfallChart key={entry.widgetId} data={attribution} />;
          rendered.push(node);
        }
        continue;

      case "pnl-by-commodity":
        flushHalves();
        if (riskSummary?.byCommodity && riskSummary.byCommodity.length > 0) {
          node = <PnlByCommodityChart key={entry.widgetId} data={riskSummary.byCommodity} />;
          rendered.push(node);
        }
        continue;

      case "alerts":
        flushHalves();
        node = (
          <AlertsPanel
            key={entry.widgetId}
            totalOpen={Number(totalOpen)}
            pendingApproval={pendingApproval}
            criticalRolls={criticalRolls}
          />
        );
        rendered.push(node);
        continue;

      case "site-monthly-detail":
        flushHalves();
        if (currentSiteId) {
          node = <SiteMonthlyDetail key={entry.widgetId} siteId={currentSiteId} orgId={orgId} />;
          rendered.push(node);
        }
        continue;

      case "site-all-in-summary":
        flushHalves();
        if (currentSiteId) {
          node = <SiteAllInSummary key={entry.widgetId} siteId={currentSiteId} orgId={orgId} />;
          rendered.push(node);
        }
        continue;

      default:
        continue;
    }

    if (def.size === "half") {
      halfBuffer.push({ entry, node });
      if (halfBuffer.length === 2) flushHalves();
    } else {
      flushHalves();
      rendered.push(node);
    }
  }

  flushHalves();

  return <>{rendered}</>;
}
