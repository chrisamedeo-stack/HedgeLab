"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import type { PnlAttribution } from "@/types/risk";

interface PnlWaterfallChartProps {
  data: PnlAttribution[];
  height?: number;
}

interface WaterfallBar {
  label: string;
  spacer: number;
  value: number;
  isTotal: boolean;
}

export function PnlWaterfallChart({ data, height = 300 }: PnlWaterfallChartProps) {
  // Aggregate all attributions (across commodities)
  const agg = data.reduce(
    (acc, a) => ({
      priorPnl: acc.priorPnl + Number(a.prior_total_pnl),
      currentPnl: acc.currentPnl + Number(a.current_total_pnl),
      priceMoves: acc.priceMoves + Number(a.price_change_pnl),
      newTrades: acc.newTrades + Number(a.new_trades_pnl),
      offsets: acc.offsets + Number(a.closed_positions_pnl),
      rollCosts: acc.rollCosts + Number(a.roll_pnl),
      basis: acc.basis + Number(a.basis_pnl),
    }),
    { priorPnl: 0, currentPnl: 0, priceMoves: 0, newTrades: 0, offsets: 0, rollCosts: 0, basis: 0 }
  );

  // Build waterfall bars
  // Each non-total bar: spacer = running total before this bar, value = change
  const bars: WaterfallBar[] = [];
  let running = agg.priorPnl;

  bars.push({ label: "Prior P&L", spacer: 0, value: agg.priorPnl, isTotal: true });

  const changes: [string, number][] = [
    ["Price Moves", agg.priceMoves],
    ["New Trades", agg.newTrades],
    ["Offsets", agg.offsets],
    ["Roll Costs", agg.rollCosts],
    ["Basis", agg.basis],
  ];

  for (const [label, val] of changes) {
    if (val >= 0) {
      bars.push({ label, spacer: running, value: val, isTotal: false });
    } else {
      bars.push({ label, spacer: running + val, value: Math.abs(val), isTotal: false });
    }
    running += val;
  }

  bars.push({ label: "Current P&L", spacer: 0, value: agg.currentPnl, isTotal: true });

  // Raw values for tooltip coloring
  const rawValues: Record<string, number> = {
    "Prior P&L": agg.priorPnl,
    "Price Moves": agg.priceMoves,
    "New Trades": agg.newTrades,
    "Offsets": agg.offsets,
    "Roll Costs": agg.rollCosts,
    "Basis": agg.basis,
    "Current P&L": agg.currentPnl,
  };

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">P&L Attribution</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <svg className="h-5 w-5 text-faint mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span className="text-xs text-faint">No P&L attribution data</span>
          <span className="text-xs text-faint mt-1">Run MTM to generate attribution breakdown</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">P&L Attribution Waterfall</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={bars} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="label"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
          />
          <YAxis
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: chartColors.muted }}
            formatter={(_value, _name, props) => {
              const bar = (props as unknown as { payload: WaterfallBar }).payload;
              const raw = rawValues[bar.label] ?? 0;
              return [`$${raw.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, bar.label];
            }}
            // hide spacer from tooltip
            itemSorter={() => 1}
          />
          <ReferenceLine y={0} stroke={chartColors.faint} strokeDasharray="3 3" />
          {/* Invisible spacer */}
          <Bar dataKey="spacer" stackId="waterfall" fill="transparent" />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]}>
            {bars.map((bar, idx) => {
              let fill: string;
              if (bar.isTotal) {
                fill = chartTheme.waterfallTotal;
              } else {
                const raw = rawValues[bar.label] ?? 0;
                fill = raw >= 0 ? chartTheme.pnlPositive : chartTheme.pnlNegative;
              }
              return <Cell key={idx} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
