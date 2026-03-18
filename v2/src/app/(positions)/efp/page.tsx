"use client";

import { useEffect, useState } from "react";
import { usePositionStore } from "@/store/positionStore";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { LockedPosition } from "@/types/positions";

export default function EFPPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { lockedPositions, loading, error, fetchLockedPositions } = usePositionStore();

  useEffect(() => {
    const params: Record<string, string> = { orgId };
    if (commodityId) params.commodityId = commodityId;
    fetchLockedPositions(params);
  }, [fetchLockedPositions, orgId, commodityId]);

  // Group by delivery month
  const byMonth: Record<string, LockedPosition[]> = {};
  lockedPositions.forEach((lp) => {
    const key = lp.delivery_month ?? "Unscheduled";
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(lp);
  });
  const months = Object.keys(byMonth).sort();

  // Summary KPIs
  const totalVolume = lockedPositions.reduce((s, p) => s + (p.volume ?? 0), 0);
  const totalFuturesPnl = lockedPositions.reduce((s, p) => s + (p.futures_pnl ?? 0), 0);
  const avgLockedPrice = lockedPositions.length > 0
    ? lockedPositions.reduce((s, p) => s + (p.locked_price ?? 0), 0) / lockedPositions.length
    : 0;

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">EFP / Locked Positions</h1>
        <p className="mt-0.5 text-xs text-faint">
          {lockedPositions.length} locked position{lockedPositions.length !== 1 ? "s" : ""} &middot; Exchange for Physical
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-b-default rounded-lg p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-faint">Total Locked Volume</p>
          <p className="mt-1 text-2xl font-bold text-primary tabular-nums">{totalVolume.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-b-default rounded-lg p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-faint">Avg Locked Price</p>
          <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
            {avgLockedPrice > 0 ? `$${avgLockedPrice.toFixed(4)}` : "\u2014"}
          </p>
        </div>
        <div className="bg-surface border border-b-default rounded-lg p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-faint">Total Futures P&L</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${totalFuturesPnl >= 0 ? "text-profit" : "text-loss"}`}>
            ${totalFuturesPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {loading && lockedPositions.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading locked positions...</div>
      )}

      {/* Locked positions by delivery month */}
      {months.length > 0 ? months.map((month) => (
        <div key={month} className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-b-default bg-input-bg/30">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{formatContractMonth(month)}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Volume", "Locked Price", "Futures", "Basis", "All-In Price", "Futures P&L", "Lock Date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {byMonth[month].map((lp) => (
                <tr key={lp.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 tabular-nums text-secondary">{lp.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-secondary">
                    ${Number(lp.locked_price).toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted">
                    {lp.futures_component != null ? `$${Number(lp.futures_component).toFixed(4)}` : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted">
                    {lp.basis_component != null ? `$${Number(lp.basis_component).toFixed(4)}` : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-secondary">
                    {lp.all_in_price != null ? `$${Number(lp.all_in_price).toFixed(4)}` : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className={(lp.futures_pnl ?? 0) >= 0 ? "text-profit" : "text-loss"}>
                      ${Number(lp.futures_pnl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted tabular-nums">{lp.lock_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )) : !loading && (
        <div className="bg-surface border border-b-default rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-faint">No locked positions yet</p>
          <p className="mt-1 text-xs text-faint">Lock positions from the site view by executing an EFP</p>
        </div>
      )}
    </div>
  );
}
