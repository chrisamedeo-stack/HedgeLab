"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { HedgeBookItem } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";

function fmtUsd(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  hedgeBook: HedgeBookItem[];
}

export function MtmPnlChart({ hedgeBook }: Props) {
  const data = useMemo(() => {
    return hedgeBook
      .filter((h) => h.mtmPnlUsd != null)
      .map((h) => ({
        ref: h.tradeRef.length > 12 ? h.tradeRef.slice(0, 12) + "..." : h.tradeRef,
        pnl: h.mtmPnlUsd!,
      }));
  }, [hedgeBook]);

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          MTM P&amp;L by Trade
        </h3>
        <div className="h-56 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No MTM data available</p>
          <p className="text-xs text-ph mt-1">Publish settle prices to calculate mark-to-market P&amp;L</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
        MTM P&amp;L by Trade
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="ref" tick={{ fontSize: 9, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtUsd} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 12 }}
              formatter={(value: number) => [fmtUsd(value), "MTM P&L"]}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.pnl >= 0 ? chartTheme.profit : chartTheme.loss} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
