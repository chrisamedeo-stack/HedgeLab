"use client";

import { useState, useCallback } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { InstrumentBadge } from "./InstrumentBadge";
import { PositionContextMenu } from "./PositionContextMenu";
import type { PmTrade } from "@/types/pm";

interface FinancialPositionsTableProps {
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
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function FinancialPositionsTable({
  trades,
  loading,
  selectedIds,
  onSelectionChange,
  onAction,
}: FinancialPositionsTableProps) {
  const { isEnabled } = useFeatureFlags();
  const showOptions = isEnabled("options_trading");
  const showSwaps = isEnabled("swap_trading");
  const showPortfolio = isEnabled("multi_portfolio");
  const showBudgetMonth = isEnabled("budget_month");
  const showContracts = showOptions || showSwaps;

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
        <p className="text-sm text-muted">No financial positions found</p>
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
              {showContracts && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Contracts</th>
              )}
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Quantity</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Contract Mo.</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Commodity</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Instrument</th>
              {showOptions && (
                <>
                  <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Strike</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">P/C</th>
                </>
              )}
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Trade Price</th>
              <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Mkt Price</th>
              {showBudgetMonth && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Budget Mo.</th>
              )}
              {showPortfolio && (
                <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider">Portfolio</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-tbl-border">
            {trades.map((trade, i) => {
              const isSelected = selectedIds.has(trade.id);
              const dirColor = trade.direction === "long" ? "text-profit" : "text-loss";
              const dirArrow = trade.direction === "long" ? "▲" : "▼";
              const dirLabel = trade.direction === "long" ? "Long" : "Short";

              // Market price color: red if above trade price (adverse for long buyer), green if below
              let mktColor = "text-secondary";
              if (trade.market_price !== null && trade.trade_price !== null) {
                if (trade.direction === "long") {
                  mktColor = trade.market_price >= trade.trade_price ? "text-profit" : "text-loss";
                } else {
                  mktColor = trade.market_price <= trade.trade_price ? "text-profit" : "text-loss";
                }
              }

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
                  {showContracts && (
                    <td className="px-3 py-2 text-right text-faint">{trade.contracts ?? "—"}</td>
                  )}
                  <td className="px-3 py-2 text-right text-primary">{fmtNum(Number(trade.quantity), 0)}</td>
                  <td className="px-3 py-2 text-faint">{trade.contract_month ?? "—"}</td>
                  <td className="px-3 py-2 text-secondary">{trade.commodity}</td>
                  <td className="px-3 py-2"><InstrumentBadge instrument={trade.instrument} /></td>
                  {showOptions && (
                    <>
                      <td className="px-3 py-2 text-right text-faint">{trade.strike !== null ? fmtNum(Number(trade.strike)) : "—"}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: "#FAC775" }}>{trade.put_call ?? ""}</td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right text-primary">{trade.trade_price !== null ? fmtNum(Number(trade.trade_price)) : "—"}</td>
                  <td className={`px-3 py-2 text-right ${mktColor}`}>{trade.market_price !== null ? fmtNum(Number(trade.market_price)) : "—"}</td>
                  {showBudgetMonth && (
                    <td className="px-3 py-2 text-faint">{trade.budget_month ? new Date(trade.budget_month).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</td>
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

      {/* Context menu */}
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
