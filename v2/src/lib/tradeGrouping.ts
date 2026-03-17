// ─── Trade Grouping Utilities ────────────────────────────────────────────────
// Pure functions for grouping trades by commodity + direction + contract month,
// computing VWAP, and distributing allocation volume proportionally.

import type { FinancialTrade, TradeGroupSummary, CommodityGroup, TradeStatus } from "@/types/trades";

// ─── VWAP ───────────────────────────────────────────────────────────────────

/**
 * Compute volume-weighted average price.
 * Returns 0 if total volume is 0.
 */
export function computeVWAP(trades: FinancialTrade[]): number {
  let sumVP = 0;
  let sumV = 0;
  for (const t of trades) {
    const v = Number(t.total_volume) || 0;
    const p = Number(t.trade_price) || 0;
    sumVP += v * p;
    sumV += v;
  }
  return sumV > 0 ? sumVP / sumV : 0;
}

// ─── Aggregate Status ───────────────────────────────────────────────────────

function deriveAggregateStatus(trades: FinancialTrade[]): TradeStatus {
  const statuses = new Set(trades.map((t) => t.status));
  if (statuses.size === 1) return trades[0].status;
  // If any trade is open or partially allocated, the group is partial
  if (statuses.has("open") || statuses.has("partially_allocated")) return "partially_allocated";
  if (statuses.has("fully_allocated")) return "fully_allocated";
  if (statuses.has("rolled")) return "rolled";
  return "open";
}

// ─── Contract Month Sort Key ────────────────────────────────────────────────

const MONTH_CODE_ORDER: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

/**
 * Convert a contract month code (e.g. "ZCN26") to a sortable numeric key.
 * Extracts the month letter and 2-digit year from the end.
 */
function contractMonthSortKey(code: string): number {
  const match = code.match(/([A-Z])(\d{2})$/);
  if (!match) return 0;
  const monthNum = MONTH_CODE_ORDER[match[1]] ?? 0;
  const year = Number(match[2]);
  return year * 100 + monthNum;
}

// ─── Group Trades ───────────────────────────────────────────────────────────

/**
 * Groups trades by commodity + direction + contract month.
 * - Excludes cancelled trades from grouping.
 * - Sorts commodity groups alphabetically by name.
 * - Within each commodity, sorts by direction (long first) then contract month chronologically.
 */
export function groupTrades(trades: FinancialTrade[]): CommodityGroup[] {
  // Filter out cancelled trades and swaps
  const eligible = trades.filter(
    (t) => t.status !== "cancelled" && t.trade_type !== "swap"
  );

  // Build a map of groupId → trades
  const groupMap = new Map<string, FinancialTrade[]>();
  for (const t of eligible) {
    const key = `${t.commodity_id}|${t.direction}|${t.contract_month}`;
    const arr = groupMap.get(key);
    if (arr) arr.push(t);
    else groupMap.set(key, [t]);
  }

  // Build TradeGroupSummary for each group
  const summaries: TradeGroupSummary[] = [];
  for (const [groupId, groupTrades] of groupMap) {
    const first = groupTrades[0];
    const totalVolume = groupTrades.reduce((s, t) => s + (Number(t.total_volume) || 0), 0);
    const allocatedVolume = groupTrades.reduce((s, t) => s + (Number(t.allocated_volume) || 0), 0);
    summaries.push({
      groupId,
      commodityId: first.commodity_id,
      commodityName: first.commodity_name ?? first.commodity_id,
      direction: first.direction,
      contractMonth: first.contract_month,
      trades: groupTrades,
      tradeCount: groupTrades.length,
      totalVolume,
      vwap: computeVWAP(groupTrades),
      allocatedVolume,
      unallocatedVolume: totalVolume - allocatedVolume,
      aggregateStatus: deriveAggregateStatus(groupTrades),
    });
  }

  // Group summaries by commodity
  const commodityMap = new Map<string, TradeGroupSummary[]>();
  for (const s of summaries) {
    const arr = commodityMap.get(s.commodityId);
    if (arr) arr.push(s);
    else commodityMap.set(s.commodityId, [s]);
  }

  // Build CommodityGroup[], sort alphabetically by commodity name
  const result: CommodityGroup[] = [];
  for (const [commodityId, groups] of commodityMap) {
    // Sort within commodity: long before short, then by contract month chronologically
    groups.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === "long" ? -1 : 1;
      return contractMonthSortKey(a.contractMonth) - contractMonthSortKey(b.contractMonth);
    });
    result.push({
      commodityId,
      commodityName: groups[0].commodityName,
      groups,
    });
  }

  result.sort((a, b) => a.commodityName.localeCompare(b.commodityName));
  return result;
}

// ─── Get Swap Trades ────────────────────────────────────────────────────────

/**
 * Extract swap trades (not grouped, shown in a flat section).
 * Excludes cancelled swaps.
 */
export function getSwapTrades(trades: FinancialTrade[]): FinancialTrade[] {
  return trades.filter((t) => t.trade_type === "swap" && t.status !== "cancelled");
}

// ─── Proportional Volume Distribution ───────────────────────────────────────

export interface VolumeDistribution {
  tradeId: string;
  volume: number;
}

/**
 * Distributes a total allocation volume across trades proportional to their
 * unallocated volume. The last trade absorbs any rounding remainder.
 *
 * Returns an empty array if totalVolume <= 0 or no trades have unallocated volume.
 */
export function distributeVolumeProportionally(
  trades: FinancialTrade[],
  totalVolume: number
): VolumeDistribution[] {
  if (totalVolume <= 0) return [];

  const eligible = trades.filter((t) => Number(t.unallocated_volume) > 0);
  if (eligible.length === 0) return [];

  const totalUnalloc = eligible.reduce((s, t) => s + Number(t.unallocated_volume), 0);
  if (totalUnalloc <= 0) return [];

  // Cap at total unallocated
  const allocVol = Math.min(totalVolume, totalUnalloc);

  const result: VolumeDistribution[] = [];
  let distributed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const t = eligible[i];
    const unalloc = Number(t.unallocated_volume);
    const isLast = i === eligible.length - 1;

    if (isLast) {
      // Last trade absorbs remainder
      result.push({ tradeId: t.id, volume: allocVol - distributed });
    } else {
      const share = Math.round((unalloc / totalUnalloc) * allocVol);
      result.push({ tradeId: t.id, volume: share });
      distributed += share;
    }
  }

  return result.filter((r) => r.volume > 0);
}
