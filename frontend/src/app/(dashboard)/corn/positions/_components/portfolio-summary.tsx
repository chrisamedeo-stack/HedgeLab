import type { HedgeBookItem } from "@/hooks/useCorn";
import { fmtPnl, fmtVol, pnlColor } from "@/lib/corn-format";
import { cn } from "@/lib/utils";
import { BUSHELS_PER_LOT } from "./shared";

interface PortfolioSummaryProps {
  hedgeBook: HedgeBookItem[];
  bookLabel: string;
}

export function PortfolioSummary({ hedgeBook, bookLabel }: PortfolioSummaryProps) {
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

  return (
    <div className="bg-surface border border-b-default rounded-lg px-5 py-4 space-y-4">
      <p className="text-xs text-faint uppercase tracking-wider">Portfolio Summary &middot; {bookLabel}</p>

      {/* Row 1: MTM, VWAP, Long, Short */}
      <div className="grid grid-cols-4 gap-6">
        <Stat label="Portfolio MTM" value={fmtPnl(portfolioMtm)} className={pnlColor(portfolioMtm)} large />
        <Stat label="VWAP (All Trades)" value={vwap > 0 ? `$${vwap.toFixed(4)}/bu` : "\u2013"} />
        <Stat label="Long Exposure" value={`${fmtVol(longBu)} bu`} sub={`${fmtVol(longLots)} lots`} />
        <Stat label="Short Exposure" value={`${fmtVol(shortBu)} bu`} sub={`${fmtVol(shortLots)} lots`} />
      </div>

      {/* Row 2: Total Trades, Allocated, Unallocated */}
      <div className="grid grid-cols-3 gap-6 border-t border-b-default pt-4">
        <Stat label="Total Trades" value={`${hedgeBook.length} trades`} />
        <Stat label="Allocated" value={`${fmtVol(allocBu)} bu`} />
        <Stat label="Unallocated" value={`${fmtVol(unallocBu)} bu`} className={unallocBu > 0 ? "text-warning" : undefined} />
      </div>
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
