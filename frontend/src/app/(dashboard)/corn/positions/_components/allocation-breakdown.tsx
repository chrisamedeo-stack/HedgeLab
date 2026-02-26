"use client";

import { Trash2 } from "lucide-react";
import { useHedgeAllocations } from "@/hooks/useCorn";
import { fmtBu } from "@/lib/corn-format";
import type { usePermissions } from "./permissions";

interface AllocationBreakdownProps {
  tradeId: number;
  can: ReturnType<typeof usePermissions>["can"];
  onUndo: (allocationId: number, tradeRef: string) => void;
}

export function AllocationBreakdown({ tradeId, can, onUndo }: AllocationBreakdownProps) {
  const { allocations, isLoading } = useHedgeAllocations(tradeId);

  if (isLoading) return <div className="px-4 py-2 text-xs text-faint">Loading allocations&hellip;</div>;
  if (allocations.length === 0) return <div className="px-4 py-2 text-xs text-faint">No allocations yet</div>;

  const byMonth = new Map<string, typeof allocations>();
  for (const a of allocations) {
    const list = byMonth.get(a.budgetMonth) || [];
    list.push(a);
    byMonth.set(a.budgetMonth, list);
  }

  const sortedMonths = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="px-4 py-2 space-y-1">
      {sortedMonths.map(([month, allocs]) => {
        const totalLots = allocs.reduce((s, a) => s + a.allocatedLots, 0);
        return (
          <div key={month} className="text-xs">
            <div className="flex items-center gap-2 text-secondary">
              <span className="text-faint">&boxur;</span>
              <span className="font-mono font-medium">{month}</span>
              <span className="text-faint">{totalLots} lots ({fmtBu(totalLots * 5000)} bu)</span>
            </div>
            {allocs.map((a) => (
              <div key={a.id} className="flex items-center gap-2 ml-6 text-faint group">
                <span>&boxur;</span>
                {a.siteCode ? (
                  <span className="bg-input-bg text-secondary px-1.5 py-0.5 rounded text-xs font-mono">{a.siteCode}</span>
                ) : (
                  <span className="italic text-ph">unassigned</span>
                )}
                <span>{a.allocatedLots} lots</span>
                {can("undo-allocation") && (
                  <button
                    onClick={() => onUndo(a.id, a.tradeRef)}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-faint hover:text-destructive transition-all"
                    title="Remove allocation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
