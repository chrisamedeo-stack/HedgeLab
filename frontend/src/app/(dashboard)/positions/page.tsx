"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { Layers } from "lucide-react";

interface PositionResponse {
  id: number;
  bookCode: string;
  commodityCode: string;
  deliveryMonth: string;
  positionType: string;
  netQuantity: string;
  quantityUnit: string;
  mtmValueUsd: string | null;
}

export default function PositionsPage() {
  const { data: positions, isLoading } = useSWR<PositionResponse[]>(
    "/api/v1/positions",
    (url: string) => api.get<PositionResponse[]>(url),
    { refreshInterval: 60_000 }
  );

  const commodities = Array.from(new Set(positions?.map((p) => p.commodityCode) ?? [])).sort();
  const months      = Array.from(new Set(positions?.map((p) => p.deliveryMonth) ?? [])).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-action" />
        <h1 className="text-xl font-bold text-primary">Position Matrix</h1>
      </div>

      {isLoading ? (
        <p className="text-faint text-sm">Loading positions\u2026</p>
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-auto">
          <table className="text-sm">
            <thead className="bg-input-bg/50 border-b border-b-default">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider sticky left-0 bg-input-bg">
                  Commodity / Month
                </th>
                {months.map((m) => (
                  <th key={m} className="px-4 py-3 text-right text-xs font-semibold text-faint uppercase tracking-wider font-mono whitespace-nowrap">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((commodity) => (
                <tr key={commodity} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 font-medium text-secondary sticky left-0 bg-surface">{commodity}</td>
                  {months.map((month) => {
                    const pos = positions?.find(
                      (p) => p.commodityCode === commodity && p.deliveryMonth === month
                    );
                    const qty = pos ? parseFloat(pos.netQuantity) : 0;
                    return (
                      <td key={month} className={`px-4 py-2.5 text-right font-mono text-xs ${
                        qty > 0 ? "text-profit" : qty < 0 ? "text-loss" : "text-ph"
                      }`}>
                        {qty !== 0 ? qty.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "\u2014"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {commodities.length === 0 && (
                <tr>
                  <td colSpan={months.length + 1} className="px-4 py-8 text-center text-faint">
                    No positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Position list */}
      {positions && positions.length > 0 && (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-input-bg/50 border-b border-b-default">
              <tr>
                {["Book", "Commodity", "Month", "Type", "Net Qty", "Unit", "MtM USD"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 text-secondary">{p.bookCode}</td>
                  <td className="px-4 py-2.5 text-secondary">{p.commodityCode}</td>
                  <td className="px-4 py-2.5 font-mono text-secondary">{p.deliveryMonth}</td>
                  <td className="px-4 py-2.5 text-muted">{p.positionType}</td>
                  <td className={`px-4 py-2.5 font-mono text-right ${
                    parseFloat(p.netQuantity) >= 0 ? "text-profit" : "text-loss"
                  }`}>{parseFloat(p.netQuantity).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-muted">{p.quantityUnit}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-secondary">
                    {p.mtmValueUsd ? `$${Number(p.mtmValueUsd).toLocaleString()}` : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
