"use client";

import type { SiteSummary } from "@/types/dashboard";

interface Props {
  sites: SiteSummary[];
  loading?: boolean;
  onSelect: (siteId: string, siteName: string) => void;
}

export function SiteCardGrid({ sites, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-b-default rounded-lg p-4 animate-pulse">
            <div className="h-3 w-24 bg-hover rounded mb-3" />
            <div className="h-6 w-16 bg-hover rounded mb-2" />
            <div className="h-3 w-28 bg-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (sites.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sites.map((s) => {
        const pct = s.coveragePct;
        const color = pct >= 80 ? "text-profit" : pct >= 50 ? "text-warning" : "text-loss";
        return (
          <button
            key={s.siteId}
            onClick={() => onSelect(s.siteId, s.siteName)}
            className="text-left bg-surface border border-b-default rounded-lg p-4 hover:border-action-40 hover:bg-hover transition-colors group"
          >
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="text-xs font-semibold text-secondary group-hover:text-primary transition-colors">
                {s.siteName}
              </h3>
              <span className="text-[10px] font-mono text-faint">{s.siteCode}</span>
            </div>
            <div className="text-[10px] text-faint mb-1.5">{s.siteType}</div>
            <div className={`text-lg font-bold tabular-nums ${color}`}>
              {pct}%
            </div>
            <div className="text-[11px] text-faint">coverage</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-faint">Open</span>
                <span className="ml-1 text-muted tabular-nums">{s.openHedges}</span>
              </div>
              <div>
                <span className="text-faint">Locked</span>
                <span className="ml-1 text-profit tabular-nums">{s.lockedHedges}</span>
              </div>
            </div>
            <div className="mt-2 h-1 w-full rounded-full bg-input-bg overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-profit" : pct >= 50 ? "bg-warning" : "bg-loss"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
