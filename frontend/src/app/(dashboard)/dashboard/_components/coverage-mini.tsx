"use client";

import Link from "next/link";
import { CoverageResponse } from "@/hooks/useCorn";
import { cn } from "@/lib/utils";

interface CoverageMiniProps {
  coverage: CoverageResponse[];
}

function barColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function pctColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

export function CoverageMini({ coverage }: CoverageMiniProps) {
  const display = coverage.slice(0, 5);

  if (display.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Coverage by Site
        </h2>
        {coverage.length > 5 && (
          <Link href="/corn/coverage" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
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
                <span className="text-sm text-slate-300">{site.siteName}</span>
                <span className={cn("text-sm font-semibold tabular-nums", pctColor(pct))}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", barColor(pct))}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800">
        <Link href="/corn/coverage" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          Open full coverage dashboard →
        </Link>
      </div>
    </div>
  );
}
