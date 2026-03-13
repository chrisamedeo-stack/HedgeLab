"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, cn } from "./shared";
import { TableSkeleton, EmptyState } from "./SharedUI";

export function CommoditiesTab() {
  const [commodities, setCommodities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/kernel/commodities");
      setCommodities(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
      </div>

      {loading ? <TableSkeleton /> : commodities.length === 0 ? (
        <EmptyState title="No commodities" desc="No commodities configured." />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Code","Name","Category","Unit","Currency","Exchange","Contract Size","Active"].map(h =>
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((c: any) => (
                <tr key={c.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-action">{c.id}</td>
                  <td className="px-3 py-3 text-secondary">{c.name}</td>
                  <td className="px-3 py-3 text-muted">{c.category}</td>
                  <td className="px-3 py-3 text-muted">{c.unit}</td>
                  <td className="px-3 py-3 text-muted">{c.currency}</td>
                  <td className="px-3 py-3 text-muted">{c.exchange ?? "\u2014"}</td>
                  <td className="px-3 py-3 text-muted font-mono">{c.contract_size?.toLocaleString() ?? "\u2014"}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      (c.is_active ?? true) ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                      {(c.is_active ?? true) ? "Active" : "Inactive"}
                    </span>
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
