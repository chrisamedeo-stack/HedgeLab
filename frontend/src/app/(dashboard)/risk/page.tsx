"use client";

import { useState } from "react";
import { useCreditAlerts } from "@/hooks/useRiskMetrics";
import { api } from "@/lib/api";
import type { VaRResult } from "@/types/risk";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldAlert } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";

export default function RiskPage() {
  const { alerts, isLoading } = useCreditAlerts();
  const [varResult, setVarResult] = useState<VaRResult | null>(null);
  const [varLoading, setVarLoading] = useState(false);
  const [priceIndexId, setPriceIndexId] = useState("1");
  const [positionSize, setPositionSize] = useState("10000");

  async function calcVaR() {
    setVarLoading(true);
    try {
      const result = await api.post<VaRResult>(
        `/api/v1/risk/var/calculate?priceIndexId=${priceIndexId}&positionSize=${positionSize}&lookbackDays=252`,
        {}
      );
      setVarResult(result);
    } finally {
      setVarLoading(false);
    }
  }

  const varChartData = varResult
    ? [
        { name: "1D 95%",  value: parseFloat(varResult.var1d95) },
        { name: "1D 99%",  value: parseFloat(varResult.var1d99) },
        { name: "10D 95%", value: parseFloat(varResult.var10d95) },
        { name: "10D 99%", value: parseFloat(varResult.var10d99) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-action" />
        <h1 className="text-xl font-bold text-primary">Risk Dashboard</h1>
      </div>

      {/* Credit Utilization */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">Credit Utilization</h2>
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-faint text-sm">Loading\u2026</p>
          ) : alerts.length === 0 ? (
            <p className="text-profit text-sm">All counterparties within credit limits.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.counterpartyId}
                  className={`rounded-lg border p-4 ${
                    a.alertLevel === "RED"
                      ? "bg-destructive-10 border-destructive-30"
                      : a.alertLevel === "AMBER"
                      ? "bg-warning-10 border-warning-30"
                      : "bg-input-bg/50 border-b-input"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-primary">{a.counterpartyName}</p>
                      <p className="text-xs text-faint">
                        ${Number(a.utilizedAmount).toLocaleString()} / ${Number(a.creditLimit).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${
                      a.alertLevel === "RED"   ? "text-destructive" :
                      a.alertLevel === "AMBER" ? "text-warning" :
                      "text-profit"
                    }`}>
                      {a.utilizationPct.toFixed(1)}% {a.alertLevel}
                    </span>
                  </div>
                  <div className="w-full bg-hover rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        a.alertLevel === "RED"   ? "bg-destructive" :
                        a.alertLevel === "AMBER" ? "bg-warning" :
                        "bg-profit"
                      }`}
                      style={{ width: `${Math.min(100, a.utilizationPct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VaR Calculator */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">Value at Risk Calculator</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Price Index ID</label>
              <input
                type="number"
                value={priceIndexId}
                onChange={(e) => setPriceIndexId(e.target.value)}
                className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-action"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Position Size (units)</label>
              <input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-action"
              />
            </div>
            <button
              onClick={calcVaR}
              disabled={varLoading}
              className="px-4 py-2 bg-action hover:bg-action-hover text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {varLoading ? "Calculating\u2026" : "Calculate VaR"}
            </button>
          </div>

          {varResult && (
            <div className="mt-2">
              <p className="text-xs text-faint mb-4">
                Based on {varResult.observationCount} observations ({varResult.lookbackDays}-day lookback) as of {varResult.calculationDate}
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={varChartData} barSize={40}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} tickFormatter={(v) => `$${v.toLocaleString()}`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: "8px", color: chartTheme.tooltipText }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "VaR"]}
                    />
                    <Bar dataKey="value" fill={chartTheme.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-4">
                {varChartData.map((d) => (
                  <div key={d.name} className="bg-input-bg rounded-lg p-3 text-center">
                    <p className="text-xs text-faint">{d.name}</p>
                    <p className="text-base font-bold text-primary">${d.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
