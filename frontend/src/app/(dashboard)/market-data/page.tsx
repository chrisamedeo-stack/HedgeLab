"use client";

import { useState } from "react";
import { useDailyPrices, useForwardCurve } from "@/hooks/useMarketData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";

const PRICE_INDICES = [
  { id: 1, name: "Brent Crude" },
  { id: 2, name: "WTI Crude" },
  { id: 3, name: "Henry Hub Gas" },
  { id: 4, name: "EUA Carbon" },
];

export default function MarketDataPage() {
  const [selectedIndex, setSelectedIndex] = useState(1);
  const { prices } = useDailyPrices(selectedIndex, 90);
  const { curve }  = useForwardCurve(selectedIndex);

  const chartData = prices.map((p) => ({
    date: p.priceDate,
    price: parseFloat(p.price),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-action" />
          <h1 className="text-xl font-bold text-primary">Market Data</h1>
        </div>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action"
        >
          {PRICE_INDICES.map((idx) => (
            <option key={idx.id} value={idx.id}>{idx.name}</option>
          ))}
        </select>
      </div>

      {/* Price chart */}
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-sm font-semibold text-muted mb-4">90-Day Price History</h2>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: chartTheme.tick }}
                  tickFormatter={(d) => d.slice(5)}
                  interval={14}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartTheme.tick }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: "8px", color: chartTheme.tooltipText }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                  labelFormatter={(d) => `Date: ${d}`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={chartTheme.primary}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-faint text-center py-8 text-sm">No price data available</p>
        )}
      </div>

      {/* Forward curve */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default">
          <h2 className="text-sm font-semibold text-muted">Forward Curve</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-input-bg/50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">Delivery Month</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-faint uppercase tracking-wider">Forward Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {curve.length > 0 ? curve.map((c) => (
              <tr key={c.deliveryMonth} className="hover:bg-row-hover">
                <td className="px-5 py-2.5 font-mono tabular-nums text-secondary">{c.deliveryMonth}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums text-secondary">${parseFloat(c.forwardPrice).toFixed(2)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-faint text-sm">No forward curve data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
