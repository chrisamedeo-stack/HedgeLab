"use client";

import Link from "next/link";
import type { CoverageSiteEntry } from "@/types/dashboard";

interface CoverageMiniChartProps {
  sites: CoverageSiteEntry[];
}

function coverageColor(pct: number): string {
  if (pct >= 80) return "bg-profit";
  if (pct >= 40) return "bg-warning";
  return "bg-loss";
}

function coverageTextColor(pct: number): string {
  if (pct >= 80) return "text-profit";
  if (pct >= 40) return "text-warning";
  return "text-loss";
}

export function CoverageMiniChart({ sites }: CoverageMiniChartProps) {
  const sorted = [...sites].sort((a, b) => a.coveragePct - b.coveragePct).slice(0, 5);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Site Coverage</h2>
        <Link href="/coverage" className="text-xs font-medium text-action hover:underline">
          View All
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-faint">No site coverage data</span>
        </div>
      ) : (
        <div className="space-y-5">
          {sorted.map((site) => (
            <div key={site.siteId}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary truncate mr-2">
                  {site.siteName}
                  <span className="text-faint ml-1.5">({site.siteCode})</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${coverageTextColor(site.coveragePct)}`}>
                  {site.coveragePct}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-input-bg overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${coverageColor(site.coveragePct)}`}
                  style={{ width: `${Math.min(site.coveragePct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-faint">
                  {site.coveredVolume.toLocaleString()} / {site.budgetedVolume.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
