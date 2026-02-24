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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          MTM P&amp;L by Trade
        </h3>
        <div className="h-56 flex flex-col items-center justify-center text-slate-600">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No MTM data available</p>
          <p className="text-xs text-slate-700 mt-1">Publish settle prices to calculate mark-to-market P&amp;L</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
        MTM P&amp;L by Trade
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="ref" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={fmtUsd} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", fontSize: 12 }}
              formatter={(value: number) => [fmtUsd(value), "MTM P&L"]}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
