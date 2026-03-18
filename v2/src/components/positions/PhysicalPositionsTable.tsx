"use client";

import { useState, useCallback } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import { InstrumentBadge } from "./InstrumentBadge";
import { PositionContextMenu } from "./PositionContextMenu";
import type { PmTrade } from "@/types/pm";

interface PhysicalPositionsTableProps {
  trades: PmTrade[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onAction: (action: string, trade: PmTrade) => void;
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${String(dt.getFullYear()).slice(2)}`;
}

function fmtNum(n: number | null, decimals = 2): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function PhysicalPositionsTable({
  trades,
  loading,
  selectedIds,
  onSelectionChange,
  onAction,
}: PhysicalPositionsTableProps) {
  const { isEnabled } = useFeatureFlags();
  const { leafTier, scope, tiers } = useOrgScope();
  const showBudgetMonth = isEnabled("budget_month");
  const showLogistics = isEnabled("logistics_module");
  const showPortfolio = isEnabled("multi_portfolio");

  // Hide location column when breadcrumb is at leaf level
  const isAtLeafLevel = leafTier ? scope[leafTier.tier_level] !== null : false;
  const locationLabel = leafTier?.tier_name ?? "Location";

  const [contextMenu, setContextMenu] = useState<{ trade: PmTrade; x: number; y: number } | null>(null);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === trades.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(trades.map((t) => t.id)));
    }
  }, [trades, selectedIds, onSelectionChange]);

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, trade: PmTrade) => {
      e.preventDefault();
      setContextMenu({ trade, x: e.clientX, y: e.clientY });
    },
    []
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-b-default bg-surface">
        <div className="animate-pulse space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-hover" />
          ))}
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-b-default bg-surface p-12 text-center">
        <p className="text-sm text-muted">No physical positions found</p>
        <p className="mt-1 text-xs text-faint">Adjust filters or add a new position</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-b-default bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tbl-border bg-tbl-header text-left">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === trades.length && trades.length > 0}
                  onChange={toggleAll}
                  className="rounded border-b-input"
                />
              </th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Trade ID</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Trade Date</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Direction</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Quantity</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Commodity</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Instrument</th>
              {!isAtLeafLevel && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">{locationLabel}</th>
              )}
              {showBudgetMonth && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Budget Month</th>
              )}
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Basis</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Board Mo.</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Flat Price</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
              {showLogistics && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Logistics</th>
              )}
              {showPortfolio && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Portfolio</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-tbl-border">
            {trades.map((trade, i) => {
              const isSelected = selectedIds.has(trade.id);
              const dirColor = trade.direction === "buy" ? "text-profit" : "text-loss";
              const dirArrow = trade.direction === "buy" ? "▲" : "▼";
              const dirLabel = trade.direction === "buy" ? "Buy" : "Sell";

              const basisVal = trade.basis !== null ? Number(trade.basis) : null;
              const basisColor = basisVal === null ? "" : basisVal >= 0 ? "text-profit" : "text-loss";

              return (
                <tr
                  key={trade.id}
                  onContextMenu={(e) => handleContextMenu(e, trade)}
                  className={`transition-colors hover:bg-row-hover cursor-pointer ${
                    isSelected ? "bg-action-5" : i % 2 === 1 ? "bg-tbl-stripe" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(trade.id)}
                      className="rounded border-b-input"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-action">{trade.trade_ref}</td>
                  <td className="px-3 py-2 text-secondary">{fmtDate(trade.trade_date)}</td>
                  <td className={`px-3 py-2 font-medium ${dirColor}`}>
                    {dirArrow} {dirLabel}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">{fmtNum(Number(trade.quantity), 0)}</td>
                  <td className="px-3 py-2 text-secondary">{trade.commodity}</td>
                  <td className="px-3 py-2"><InstrumentBadge instrument={trade.instrument} /></td>
                  {!isAtLeafLevel && (
                    <td className="px-3 py-2">
                      {trade.delivery_location_name ? (
                        <span className="text-secondary">{trade.delivery_location_name}</span>
                      ) : (
                        <span className="italic text-faint">undefined</span>
                      )}
                    </td>
                  )}
                  {showBudgetMonth && (
                    <td className="px-3 py-2">
                      {trade.budget_month ? (
                        <span className="text-secondary">{trade.budget_month}</span>
                      ) : (
                        <span className="italic text-faint">undefined</span>
                      )}
                    </td>
                  )}
                  <td className={`px-3 py-2 text-right ${basisColor}`}>
                    {basisVal !== null ? fmtNum(basisVal, 4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-faint">{trade.board_month ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-primary">
                    {trade.flat_price !== null ? fmtNum(Number(trade.flat_price)) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {trade.is_priced ? (
                      <span className="flex items-center gap-1 text-xs text-profit">
                        <span className="inline-block h-2 w-2 rounded-full bg-profit" /> Priced
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#FAC775" }}>
                        <span className="inline-block h-2 w-2 rounded-full border" style={{ borderColor: "#BA7517" }} /> Unpriced
                      </span>
                    )}
                  </td>
                  {showLogistics && (
                    <td className="px-3 py-2">
                      {trade.logistics_assigned ? (
                        <span className="flex items-center gap-1 text-xs text-profit">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-profit" /> Assigned
                        </span>
                      ) : (
                        <span className="text-xs text-faint">None</span>
                      )}
                    </td>
                  )}
                  {showPortfolio && (
                    <td className="px-3 py-2">
                      {trade.portfolio_name ? (
                        <span className="inline-flex rounded-full bg-action-10 px-2 py-0.5 text-xs text-action">
                          {trade.portfolio_name}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <PositionContextMenu
          trade={contextMenu.trade}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAction={onAction}
        />
      )}
    </>
  );
}
