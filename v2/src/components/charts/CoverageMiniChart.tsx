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
  // Show top 5 sorted by lowest coverage first
  const sorted = [...sites].sort((a, b) => a.coveragePct - b.coveragePct).slice(0, 5);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Site Coverage</h2>
        <Link href="/coverage" className="text-xs font-medium text-action hover:underline">
          View All
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-sm text-faint">No site coverage data</span>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((site) => (
            <div key={site.siteId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-secondary truncate mr-2">
                  {site.siteName}
                  <span className="text-faint ml-1">({site.siteCode})</span>
                </span>
                <span className={`text-xs font-bold tabular-nums ${coverageTextColor(site.coveragePct)}`}>
                  {site.coveragePct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-sm bg-input-bg overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all ${coverageColor(site.coveragePct)}`}
                  style={{ width: `${Math.min(site.coveragePct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-faint">
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
