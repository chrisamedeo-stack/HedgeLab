"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useCommodity } from "@/contexts/CommodityContext";
import { fmtVol } from "./shared";
import { ForecastRow } from "./forecast-row";
import { ForecastUpdateGrid } from "./forecast-update-grid";

export function ForecastTab({
  lines,
  isLoading,
  showGrid,
  filterSite,
  onSaved,
  onCloseForm,
  mutate,
}: {
  lines: CornBudgetLineResponse[];
  isLoading: boolean;
  showGrid: boolean;
  filterSite: string;
  onSaved: () => void;
  onCloseForm: () => void;
  mutate: () => void;
}) {
  const { config } = useCommodity();
  const BUSHELS_PER_MT = config.bushelsPerMt;

  const bySite = lines.reduce<Record<string, CornBudgetLineResponse[]>>((acc, line) => {
    (acc[line.siteCode] ??= []).push(line);
    return acc;
  }, {});

  // Lines for the forecast grid (current site filter)
  const forecastGridLines = useMemo(() => {
    if (filterSite) return lines.filter((l) => l.siteCode === filterSite);
    return lines;
  }, [lines, filterSite]);

  // KPI: Forecast Volume (total forecast MT, falls back to budget MT)
  const totalForecastMt = useMemo(() => {
    return lines.reduce((s, l) => s + (l.forecastVolumeMt ?? l.budgetVolumeMt), 0);
  }, [lines]);

  // KPI: Forecast vs Budget (total variance MT)
  const totalVariance = useMemo(() => {
    let total = 0;
    let hasAny = false;
    for (const l of lines) {
      if (l.forecastVarianceMt != null) {
        total += l.forecastVarianceMt;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [lines]);

  // KPI: Hedge Coverage (hedged / forecast * 100)
  const hedgeCoverage = useMemo(() => {
    let totalHedged = 0, totalForecast = 0;
    for (const l of lines) {
      const forecast = l.forecastVolumeMt ?? l.budgetVolumeMt;
      if (forecast > 0) {
        totalForecast += forecast;
        totalHedged += l.hedgedVolumeMt ?? 0;
      }
    }
    if (totalForecast === 0) return null;
    return (totalHedged / totalForecast) * 100;
  }, [lines]);

  // KPI: Over-hedged count
  const overHedgedCount = useMemo(() => {
    return lines.filter((l) => l.overHedged).length;
  }, [lines]);

  return (
    <>
      {/* Forecast Update Grid */}
      {showGrid && forecastGridLines.length > 0 && (
        <ForecastUpdateGrid lines={forecastGridLines} onSaved={onSaved} onCancel={onCloseForm} />
      )}

      {/* KPIs */}
      {lines.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface border border-b-default rounded-lg p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Forecast Volume</p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {totalForecastMt > 0 ? `${fmtVol(Math.round(totalForecastMt * BUSHELS_PER_MT))} bu` : "\u2014"}
            </p>
          </div>
          <div className="bg-surface border border-b-default rounded-lg p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Forecast vs Budget</p>
            <p className={cn("text-2xl font-bold tabular-nums",
              totalVariance == null ? "text-primary"
              : totalVariance < 0 ? "text-loss"
              : totalVariance > 0 ? "text-profit"
              : "text-primary")}>
              {totalVariance != null
                ? `${totalVariance > 0 ? "+" : ""}${fmtVol(Math.round(totalVariance * BUSHELS_PER_MT))} bu`
                : "\u2014"}
            </p>
          </div>
          <div className="bg-surface border border-b-default rounded-lg p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Hedge Coverage</p>
            <p className={cn("text-2xl font-bold tabular-nums",
              hedgeCoverage == null ? "text-primary"
              : hedgeCoverage >= 100 ? "text-profit"
              : hedgeCoverage >= 50 ? "text-action"
              : "text-primary")}>
              {hedgeCoverage != null ? `${hedgeCoverage.toFixed(0)}%` : "\u2014"}
            </p>
          </div>
          <div className="bg-surface border border-b-default rounded-lg p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Over-hedged</p>
            <p className={cn("text-2xl font-bold tabular-nums",
              overHedgedCount > 0 ? "text-warning" : "text-primary")}>
              {overHedgedCount}
            </p>
          </div>
        </div>
      )}

      {/* Table grouped by site */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={10} />
      ) : lines.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No budget lines yet"
          description="Create budget lines on the Budgets tab first, then return here to manage forecasts."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(bySite).map(([siteCode, siteLines]) => {
            const siteName = siteLines[0]?.siteName ?? siteCode;
            const siteForecastMt = siteLines.reduce((s, l) => s + (l.forecastVolumeMt ?? l.budgetVolumeMt), 0);
            const siteVarianceMt = siteLines.reduce((s, l) => s + (l.forecastVarianceMt ?? 0), 0);
            const siteHedgedMt   = siteLines.reduce((s, l) => s + (l.hedgedVolumeMt ?? 0), 0);
            const hasVariance    = siteLines.some((l) => l.forecastVarianceMt != null);
            const siteCoverage   = siteForecastMt > 0 ? (siteHedgedMt / siteForecastMt) * 100 : null;

            return (
              <div key={siteCode} className="bg-surface border border-b-default rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-tbl-header border-b border-b-default flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-secondary">{siteName}</span>
                    <span className="ml-2 text-xs text-faint">{siteCode}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted">
                    <span>{fmtVol(Math.round(siteForecastMt * BUSHELS_PER_MT))} bu forecast</span>
                    <span className="text-ph">&middot;</span>
                    <span>{siteLines.length} line{siteLines.length !== 1 ? "s" : ""}</span>
                    {siteCoverage != null && (
                      <>
                        <span className="text-ph">&middot;</span>
                        <span className={cn(siteCoverage >= 100 ? "text-profit" : siteCoverage >= 50 ? "text-action" : "text-muted")}>
                          {siteCoverage.toFixed(0)}% hedged
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-input-bg/20 border-b border-b-default">
                      <th className="w-8" />
                      <th className="px-4 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider">Month</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Budget Bu</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Forecast Bu</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Variance</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-faint uppercase tracking-wider">Trend</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Hedged Bu</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Coverage %</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-faint uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-b-default">
                    {siteLines.map((line) => (
                      <ForecastRow key={line.id} line={line} onUpdated={mutate} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-b-input bg-input-bg/30">
                      <td colSpan={2} className="px-4 py-2 text-xs text-faint text-right font-medium">Subtotal</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-faint text-xs">
                        {fmtVol(Math.round(siteLines.reduce((s, l) => s + l.budgetVolumeMt, 0) * BUSHELS_PER_MT))}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-secondary text-xs">
                        {fmtVol(Math.round(siteForecastMt * BUSHELS_PER_MT))}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs font-medium">
                        {hasVariance ? (
                          <span className={siteVarianceMt < 0 ? "text-loss" : siteVarianceMt > 0 ? "text-profit" : "text-faint"}>
                            {siteVarianceMt > 0 ? "+" : ""}{fmtVol(Math.round(siteVarianceMt * BUSHELS_PER_MT))}
                          </span>
                        ) : ""}
                      </td>
                      <td />
                      <td className="px-4 py-2 text-right tabular-nums text-muted text-xs">{siteHedgedMt > 0 ? fmtVol(Math.round(siteHedgedMt * BUSHELS_PER_MT)) : ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs font-medium">
                        {siteCoverage != null ? (
                          <span className={cn(siteCoverage >= 100 ? "text-profit" : siteCoverage >= 50 ? "text-action" : "text-muted")}>
                            {siteCoverage.toFixed(0)}%
                          </span>
                        ) : ""}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
