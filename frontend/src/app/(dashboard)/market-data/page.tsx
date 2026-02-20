"use client";

import { useState } from "react";
import { useDailyPrices, useForwardCurve } from "@/hooks/useMarketData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

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
          <TrendingUp className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">Market Data</h1>
        </div>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PRICE_INDICES.map((idx) => (
            <option key={idx.id} value={idx.id}>{idx.name}</option>
          ))}
        </select>
      </div>

      {/* Price chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4">90-Day Price History</h2>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(d) => d.slice(5)}
                  interval={14}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                  labelFormatter={(d) => `Date: ${d}`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8 text-sm">No price data available</p>
        )}
      </div>

      {/* Forward curve */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-400">Forward Curve</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Month</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Forward Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {curve.length > 0 ? curve.map((c) => (
              <tr key={c.deliveryMonth} className="hover:bg-slate-800/40">
                <td className="px-5 py-2.5 font-mono text-slate-300">{c.deliveryMonth}</td>
                <td className="px-5 py-2.5 text-right font-mono text-slate-200">${parseFloat(c.forwardPrice).toFixed(2)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-slate-500 text-sm">No forward curve data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
