"use client";

import Link from "next/link";
import { CoverageResponse } from "@/hooks/useCorn";
import { SiteWithCountry } from "@/lib/dashboard-aggregation";
import { cn } from "@/lib/utils";

interface CoverageMiniProps {
  coverage: CoverageResponse[];
  filterCountry?: string;
  sites?: SiteWithCountry[];
}

function barColor(pct: number) {
  if (pct >= 80) return "bg-profit";
  if (pct >= 50) return "bg-warning";
  return "bg-warning";
}

function pctColor(pct: number) {
  if (pct >= 80) return "text-profit";
  if (pct >= 50) return "text-warning";
  return "text-warning";
}

export function CoverageMini({ coverage, filterCountry, sites }: CoverageMiniProps) {
  let filtered = coverage;
  if (filterCountry && sites) {
    const countrySites = new Set(
      sites.filter((s) => s.country === filterCountry).map((s) => s.code)
    );
    filtered = coverage.filter((c) => countrySites.has(c.siteCode));
  }
  // Sort by lowest coverage first (most actionable)
  const sorted = [...filtered].sort((a, b) => (a.coveragePct ?? 0) - (b.coveragePct ?? 0));
  const display = sorted.slice(0, 5);

  if (display.length === 0) return null;

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Coverage by Site
        </h2>
        {sorted.length > 5 && (
          <Link href="/corn/coverage" className="text-xs text-action hover:text-action-hover transition-colors">
            View all →
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {display.map((site) => {
          const pct = Math.min(site.coveragePct ?? 0, 100);
          return (
            <div key={site.siteCode} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">{site.siteName}</span>
                <span className={cn("text-sm font-semibold tabular-nums", pctColor(pct))}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-input-bg rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", barColor(pct))}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-b-default">
        <Link href="/corn/coverage" className="text-xs text-action hover:text-action-hover transition-colors">
          Open full coverage dashboard →
        </Link>
      </div>
    </div>
  );
}
