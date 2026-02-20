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
        <Layers className="h-6 w-6 text-blue-400" />
        <h1 className="text-xl font-bold text-slate-100">Position Matrix</h1>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading positions…</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-auto">
          <table className="text-sm">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-800">
                  Commodity / Month
                </th>
                {months.map((m) => (
                  <th key={m} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono whitespace-nowrap">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {commodities.map((commodity) => (
                <tr key={commodity} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-medium text-slate-300 sticky left-0 bg-slate-900">{commodity}</td>
                  {months.map((month) => {
                    const pos = positions?.find(
                      (p) => p.commodityCode === commodity && p.deliveryMonth === month
                    );
                    const qty = pos ? parseFloat(pos.netQuantity) : 0;
                    return (
                      <td key={month} className={`px-4 py-2.5 text-right font-mono text-xs ${
                        qty > 0 ? "text-emerald-400" : qty < 0 ? "text-red-400" : "text-slate-600"
                      }`}>
                        {qty !== 0 ? qty.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {commodities.length === 0 && (
                <tr>
                  <td colSpan={months.length + 1} className="px-4 py-8 text-center text-slate-500">
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                {["Book", "Commodity", "Month", "Type", "Net Qty", "Unit", "MtM USD"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-300">{p.bookCode}</td>
                  <td className="px-4 py-2.5 text-slate-300">{p.commodityCode}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">{p.deliveryMonth}</td>
                  <td className="px-4 py-2.5 text-slate-400">{p.positionType}</td>
                  <td className={`px-4 py-2.5 font-mono text-right ${
                    parseFloat(p.netQuantity) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>{parseFloat(p.netQuantity).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-400">{p.quantityUnit}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {p.mtmValueUsd ? `$${Number(p.mtmValueUsd).toLocaleString()}` : "—"}
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
