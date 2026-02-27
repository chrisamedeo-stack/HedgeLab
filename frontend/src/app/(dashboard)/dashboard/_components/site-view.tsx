"use client";

import { useMemo } from "react";
import { CoverageResponse, CornPositionResponse, PhysicalContractResponse, CornBudgetLineResponse } from "@/hooks/useCorn";
import { SiteWithCountry } from "@/lib/dashboard-aggregation";
import { fmtVol, fmtPnl, pnlColor } from "@/lib/corn-format";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KpiRow } from "./kpi-row";
import { CoverageWaterfallChart } from "./coverage-waterfall-chart";
import { AlertsPanel } from "./alerts-panel";

const BUSHELS_PER_MT = 39.3683;

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function barColor(pct: number) {
  return pct >= 80 ? "bg-profit" : pct >= 40 ? "bg-warning" : "bg-loss";
}
function pctColor(pct: number) {
  return pct >= 80 ? "text-profit" : pct >= 40 ? "text-warning" : "text-loss";
}

interface SiteViewProps {
  siteCode: string;
  coverage: CoverageResponse[];
  positions: CornPositionResponse | undefined;
  contracts: PhysicalContractResponse[];
  budget: CornBudgetLineResponse[];
  sites: SiteWithCountry[];
}

export function SiteView({
  siteCode,
  coverage,
  positions,
  contracts,
  budget,
  sites,
}: SiteViewProps) {
  const siteCoverage = coverage.filter((c) => c.siteCode === siteCode);
  const siteEntry = siteCoverage[0];
  const site = sites.find((s) => s.code === siteCode);

  const budgetBu = (siteEntry?.budgetedMt ?? 0) * BUSHELS_PER_MT;
  const hedgedBu = (siteEntry?.hedgedMt ?? 0) * BUSHELS_PER_MT;
  const coveragePct = siteEntry?.coveragePct ?? 0;
  const openLots = siteEntry?.openHedgeLots ?? 0;

  const siteContracts = contracts.filter((c) => c.siteCode === siteCode);
  const activeContracts = siteContracts.filter(
    (c) => c.status !== "CANCELLED" && c.status !== "CLOSED"
  ).length;

  const siteBudget = budget.filter((b) => b.siteCode === siteCode);

  return (
    <div className="space-y-6">
      <KpiRow
        cards={[
          { label: "Site Budget", value: budgetBu, unit: "bu" },
          { label: "Hedge Coverage", value: coveragePct, unit: "pct" },
          { label: "Open Hedge Lots", value: openLots, unit: "count" },
          { label: "Active Contracts", value: activeContracts, unit: "count" },
        ]}
      />

      <CoverageWaterfallChart coverage={coverage} filterSiteCodes={[siteCode]} />

      {/* Monthly detail breakdown */}
      {siteEntry && siteEntry.months && siteEntry.months.length > 0 && (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-b-default">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
              Monthly Detail
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-tbl-header border-b border-b-default">
                <th className="px-5 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Budget</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Hedged</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Committed</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">EFP</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Received</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider w-44">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default/60">
              {siteEntry.months.map((m) => {
                const mPct = m.coveragePct ?? 0;
                const clamped = Math.min(Math.max(mPct, 0), 100);
                return (
                  <tr key={m.month} className="hover:bg-row-hover transition-colors">
                    <td className="px-5 py-3 font-medium text-secondary whitespace-nowrap">
                      {monthLabel(m.month)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">
                      {fmtVol((m.budgetedMt ?? 0) * BUSHELS_PER_MT)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-profit">
                      {(m.hedgedMt ?? 0) > 0 ? fmtVol((m.hedgedMt ?? 0) * BUSHELS_PER_MT) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-action">
                      {(m.committedMt ?? 0) > 0 ? fmtVol((m.committedMt ?? 0) * BUSHELS_PER_MT) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-action">
                      {(m.efpdMt ?? 0) > 0 ? fmtVol((m.efpdMt ?? 0) * BUSHELS_PER_MT) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">
                      {(m.receivedMt ?? 0) > 0 ? fmtVol((m.receivedMt ?? 0) * BUSHELS_PER_MT) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-input-bg rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", barColor(clamped))}
                            style={{ width: `${clamped}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", pctColor(mPct))}>
                          {formatPct(mPct)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget component targets */}
      {siteBudget.length > 0 && siteBudget.some((b) => b.components && b.components.length > 0) && (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-b-default">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
              Budget Component Targets
            </h3>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {siteBudget
                .flatMap((b) => b.components ?? [])
                .filter((c, i, arr) => arr.findIndex((x) => x.componentName === c.componentName) === i)
                .map((comp) => (
                  <div key={comp.componentName} className="bg-input-bg/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-faint mb-0.5">{comp.componentName}</p>
                    <p className="text-sm font-semibold text-secondary tabular-nums">
                      {comp.targetValue != null ? formatNumber(comp.targetValue) : "—"} {comp.unit}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <AlertsPanel
        coverage={coverage}
        positions={positions}
        contracts={contracts}
        filterSiteCodes={[siteCode]}
      />
    </div>
  );
}
