import { useMemo } from "react";
import type { HedgeBookItem, SiteAllocationItem } from "@/hooks/useCorn";
import { useCommodity } from "@/contexts/CommodityContext";
import { fmtPnl, pnlColor } from "@/lib/corn-format";
import { fmtVol } from "@/lib/commodity-format";
import { cn } from "@/lib/utils";

interface PortfolioSummaryProps {
  hedgeBook: HedgeBookItem[];
  bookLabel: string;
  siteAllocations?: SiteAllocationItem[];
  unassignedBu?: number;
}

export function PortfolioSummary({ hedgeBook, bookLabel, siteAllocations = [], unassignedBu = 0 }: PortfolioSummaryProps) {
  const { config } = useCommodity();
  const BUSHELS_PER_LOT = config.contractSizeBu;
  const portfolioMtm = hedgeBook.reduce((s, h) => s + (h.mtmPnlUsd ?? 0), 0);
  const totalBu = hedgeBook.reduce((s, h) => s + h.bushels, 0);
  const unallocBu = hedgeBook.reduce((s, h) => s + h.unallocatedBushels, 0);
  const allocBu = totalBu - unallocBu;

  // VWAP = sum(lots × entryPrice) / sum(lots)
  const sumWt = hedgeBook.reduce((s, h) => s + h.lots * h.entryPrice, 0);
  const sumLots = hedgeBook.reduce((s, h) => s + h.lots, 0);
  const vwap = sumLots > 0 ? sumWt / sumLots : 0;

  // Long / Short exposure
  const longBu = hedgeBook.filter((h) => h.side === "LONG").reduce((s, h) => s + h.bushels, 0);
  const shortBu = hedgeBook.filter((h) => h.side === "SHORT").reduce((s, h) => s + h.bushels, 0);
  const longLots = longBu / BUSHELS_PER_LOT;
  const shortLots = shortBu / BUSHELS_PER_LOT;

  // Site breakdown from allocations
  const siteSummary = useMemo(() => {
    const map = new Map<string, { lots: number; bu: number }>();
    for (const a of siteAllocations) {
      const prev = map.get(a.siteCode) || { lots: 0, bu: 0 };
      map.set(a.siteCode, { lots: prev.lots + a.allocatedLots, bu: prev.bu + a.allocatedBushels });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, { lots, bu }]) => ({ code, lots, bu }));
  }, [siteAllocations]);

  const showSiteRow = siteSummary.length > 0 || unassignedBu > 0;

  return (
    <div className="bg-surface border border-b-default rounded-lg px-5 py-4 space-y-4">
      <p className="text-xs text-faint uppercase tracking-wider">Portfolio Summary &middot; {bookLabel}</p>

      {/* Row 1: MTM, VWAP, Long, Short */}
      <div className="grid grid-cols-4 gap-6">
        <Stat label="Portfolio MTM" value={fmtPnl(portfolioMtm)} className={pnlColor(portfolioMtm)} large />
        <Stat label="VWAP (All Trades)" value={vwap > 0 ? `$${vwap.toFixed(4)}/bu` : "\u2013"} />
        <Stat label="Long Exposure" value={`${fmtVol(longBu, config.bushelsPerMt)} bu`} sub={`${fmtVol(longLots, config.bushelsPerMt)} lots`} />
        <Stat label="Short Exposure" value={`${fmtVol(shortBu, config.bushelsPerMt)} bu`} sub={`${fmtVol(shortLots, config.bushelsPerMt)} lots`} />
      </div>

      {/* Row 2: Total Trades, Allocated, Unallocated */}
      <div className="grid grid-cols-3 gap-6 border-t border-b-default pt-4">
        <Stat label="Total Trades" value={`${hedgeBook.length} trades`} />
        <Stat label="Allocated" value={`${fmtVol(allocBu, config.bushelsPerMt)} bu`} />
        <Stat label="Unallocated" value={`${fmtVol(unallocBu, config.bushelsPerMt)} bu`} className={unallocBu > 0 ? "text-warning" : undefined} />
      </div>

      {/* Row 3: Site Breakdown */}
      {showSiteRow && (
        <div className="border-t border-b-default pt-4">
          <p className="text-xs text-faint mb-2">Site Allocations</p>
          <div className="flex flex-wrap items-center gap-2">
            {siteSummary.map((s) => (
              <span key={s.code} className="inline-flex items-center gap-1.5 bg-input-bg text-secondary px-2.5 py-1 rounded text-xs font-mono">
                <span className="font-semibold">{s.code}:</span>
                {fmtVol(s.bu, config.bushelsPerMt)} bu
                <span className="text-faint">({fmtVol(s.lots, config.bushelsPerMt)} lots)</span>
              </span>
            ))}
            {unassignedBu > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-warning-15 text-warning px-2.5 py-1 rounded text-xs font-mono">
                <span className="font-semibold">Unassigned:</span>
                {fmtVol(unassignedBu, config.bushelsPerMt)} bu
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, className, large }: { label: string; value: string; sub?: string; className?: string; large?: boolean }) {
  return (
    <div>
      <p className="text-xs text-faint mb-1">{label}</p>
      <p className={cn(large ? "text-2xl font-bold" : "text-lg font-semibold", "tabular-nums", className ?? "text-secondary")}>
        {value}
      </p>
      {sub && <p className="text-xs text-faint mt-0.5">{sub}</p>}
    </div>
  );
}
