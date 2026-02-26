"use client";

import { CoverageResponse } from "@/hooks/useCorn";
import { fmtVol } from "@/lib/corn-format";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SiteSummaryTableProps {
  coverage: CoverageResponse[];
  onSelectSite: (siteCode: string) => void;
}

function pctColor(pct: number) {
  return pct >= 80 ? "text-profit" : pct >= 50 ? "text-warning" : "text-warning";
}
function barColor(pct: number) {
  return pct >= 80 ? "bg-profit" : pct >= 50 ? "bg-warning" : "bg-warning";
}

const BUSHELS_PER_MT = 39.3683;

export function SiteSummaryTable({ coverage, onSelectSite }: SiteSummaryTableProps) {
  const sorted = [...coverage].sort((a, b) => (a.coveragePct ?? 0) - (b.coveragePct ?? 0));

  if (sorted.length === 0) return null;

  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-b-default">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Sites</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-input-bg/40 border-b border-b-default">
            <th className="px-5 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider">Site</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Budget (bu)</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Hedged (bu)</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Committed (bu)</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-faint uppercase tracking-wider">Open Lots</th>
            <th className="px-5 py-2 text-left text-xs font-medium text-faint uppercase tracking-wider w-48">Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-b-default/60">
          {sorted.map((site) => {
            const pct = site.coveragePct ?? 0;
            const clamped = Math.min(Math.max(pct, 0), 100);
            return (
              <tr
                key={site.siteCode}
                onClick={() => onSelectSite(site.siteCode)}
                className="hover:bg-row-hover transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <p className="font-medium text-secondary">{site.siteName}</p>
                  <p className="text-xs text-faint">{site.siteCode}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-secondary">
                  {fmtVol((site.budgetedMt ?? 0) * BUSHELS_PER_MT)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-profit">
                  {fmtVol((site.hedgedMt ?? 0) * BUSHELS_PER_MT)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-action">
                  {fmtVol((site.committedMt ?? 0) * BUSHELS_PER_MT)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-secondary">
                  {site.openHedgeLots ?? 0}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-input-bg rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor(clamped))}
                        style={{ width: `${clamped}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", pctColor(pct))}>
                      {formatPct(pct)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
