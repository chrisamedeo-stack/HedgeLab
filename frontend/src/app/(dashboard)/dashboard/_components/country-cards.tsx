"use client";

import { CoverageResponse, HedgeBookItem } from "@/hooks/useCorn";
import { groupCoverageByCountry, aggregateCoverage, aggregateMtm, SiteWithCountry } from "@/lib/dashboard-aggregation";
import { fmtVol, fmtPnl, pnlColor } from "@/lib/corn-format";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Globe, MapPin } from "lucide-react";

interface CountryCardsProps {
  coverage: CoverageResponse[];
  sites: SiteWithCountry[];
  hedgeBook: HedgeBookItem[] | undefined;
  onSelectCountry: (country: string) => void;
}

function coverageColor(pct: number) {
  if (pct >= 80) return "profit";
  if (pct >= 50) return "warning";
  return "warning";
}

export function CountryCards({ coverage, sites, hedgeBook, onSelectCountry }: CountryCardsProps) {
  const grouped = groupCoverageByCountry(coverage, sites);
  const countries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  if (countries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {countries.map(([country, entries]) => {
        const agg = aggregateCoverage(entries);
        const mtm = aggregateMtm(hedgeBook);
        const siteCount = new Set(entries.map((e) => e.siteCode)).size;
        const highlight = coverageColor(agg.coveragePct);

        return (
          <button
            key={country}
            onClick={() => onSelectCountry(country)}
            className={cn(
              "bg-surface border rounded-lg p-5 text-left hover:border-action-30 transition-colors group",
              highlight === "warning" && "border-warning-30",
              highlight === "profit" && "border-profit-30",
              !highlight && "border-b-default"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-action" />
                <h3 className="text-base font-semibold text-primary group-hover:text-action transition-colors">
                  {country}
                </h3>
              </div>
              <span className={cn(
                "text-2xl font-bold tabular-nums",
                highlight === "warning" ? "text-warning" : "text-profit"
              )}>
                {formatPct(agg.coveragePct)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-faint mb-0.5">Total Budget</p>
                <p className="text-sm font-semibold text-secondary tabular-nums">
                  {fmtVol(agg.budgetBu)} bu
                </p>
              </div>
              <div>
                <p className="text-xs text-faint mb-0.5">Hedged</p>
                <p className="text-sm font-semibold text-secondary tabular-nums">
                  {fmtVol(agg.hedgedBu)} bu
                </p>
              </div>
              <div>
                <p className="text-xs text-faint mb-0.5">Sites</p>
                <p className="text-sm font-semibold text-secondary flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-faint" />
                  {siteCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-faint mb-0.5">Open Lots</p>
                <p className="text-sm font-semibold text-secondary tabular-nums">
                  {agg.openHedgeLots}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-b-default/50">
              <div className="h-1.5 bg-input-bg rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    highlight === "warning" ? "bg-warning" : "bg-profit"
                  )}
                  style={{ width: `${Math.min(agg.coveragePct, 100)}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
