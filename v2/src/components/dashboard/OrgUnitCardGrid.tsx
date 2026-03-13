"use client";

import type { UnitSummary } from "@/types/dashboard";

interface Props {
  units: UnitSummary[];
  loading?: boolean;
  onSelect: (unitId: string, unitName: string) => void;
}

export function OrgUnitCardGrid({ units, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-b-default rounded-lg p-4 animate-pulse">
            <div className="h-3 w-24 bg-hover rounded mb-3" />
            <div className="h-6 w-16 bg-hover rounded mb-2" />
            <div className="h-3 w-28 bg-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (units.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {units.map((u) => {
        const pct = u.coveragePct;
        const color = pct >= 80 ? "text-profit" : pct >= 50 ? "text-warning" : "text-loss";
        return (
          <button
            key={u.unitId}
            onClick={() => onSelect(u.unitId, u.unitName)}
            className="text-left bg-surface border border-b-default rounded-lg p-4 hover:border-action-40 hover:bg-hover transition-colors group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold text-secondary group-hover:text-primary transition-colors">
                {u.unitName}
              </h3>
              {u.alertCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-loss animate-pulse" />
              )}
            </div>
            <div className={`text-lg font-bold tabular-nums ${color}`}>
              {pct}%
            </div>
            <div className="text-[11px] text-faint">coverage</div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>{u.siteCount} site{u.siteCount !== 1 ? "s" : ""}</span>
              <span className="tabular-nums">{Number(u.totalVolume).toLocaleString()}</span>
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
