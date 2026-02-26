import type { HedgeBookItem } from "@/hooks/useCorn";
import { fmtPnl, fmtVol, pnlColor } from "@/lib/corn-format";
import { cn } from "@/lib/utils";

interface PortfolioSummaryProps {
  hedgeBook: HedgeBookItem[];
  bookLabel: string;
}

export function PortfolioSummary({ hedgeBook, bookLabel }: PortfolioSummaryProps) {
  const portfolioMtm = hedgeBook.reduce((s, h) => s + (h.mtmPnlUsd ?? 0), 0);
  const totalBu = hedgeBook.reduce((s, h) => s + h.bushels, 0);
  const unallocBu = hedgeBook.reduce((s, h) => s + h.unallocatedBushels, 0);

  return (
    <div className="bg-surface border border-b-default rounded-lg px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-faint uppercase tracking-wider mb-1">Portfolio MTM &middot; {bookLabel}</p>
          <p className={cn("text-2xl font-bold tabular-nums", pnlColor(portfolioMtm))}>
            {fmtPnl(portfolioMtm)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-faint">{hedgeBook.length} trades &middot; {fmtVol(totalBu)} bu total</p>
          <p className="text-xs text-faint">{fmtVol(unallocBu)} bu unallocated</p>
        </div>
      </div>
    </div>
  );
}
