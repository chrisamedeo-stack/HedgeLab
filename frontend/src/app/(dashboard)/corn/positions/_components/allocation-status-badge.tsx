import type { HedgeBookItem } from "@/hooks/useCorn";

export function AllocationStatusBadge({ item }: { item: HedgeBookItem }) {
  if (item.unallocatedLots === 0) {
    return (
      <span className="ml-2 bg-profit-15 text-profit ring-1 ring-profit-25 px-2 py-0.5 rounded text-xs font-medium">
        ALLOCATED
      </span>
    );
  }
  if (item.allocatedLots > 0 && item.unallocatedLots > 0) {
    return (
      <span className="ml-2 bg-warning-15 text-warning ring-1 ring-warning-25 px-2 py-0.5 rounded text-xs font-medium">
        PARTIAL
      </span>
    );
  }
  return null;
}
