"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { useSites, useCommodities } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";

interface Receipt {
  id: string;
  org_id: string;
  site_id: string;
  commodity_id: string;
  volume: number;
  price: number | null;
  counterparty: string | null;
  delivery_month: string | null;
  created_at: string;
  [key: string]: unknown;
}

export default function ReceiptsPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const res = await fetch(`${API_BASE}/api/positions/physicals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // Use physicals as "receipts" - filter for filled buy contracts
      setReceipts(data.filter((p: { direction: string; status: string }) => p.direction === "buy" && p.status === "filled"));
    } catch (err) {
      setError((err as Error).message);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [commodityId, orgId]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const siteName = (id: string) => sites?.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const commodityName = (id: string) => commodities?.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Receipts</h1>
          <p className="text-sm text-muted mt-0.5">
            {receipts.length} receipt{receipts.length !== 1 ? "s" : ""} &mdash; physical delivery receipts
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {loading && receipts.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading receipts...</div>
      )}

      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-input-bg/50 border-b border-b-default">
            <tr>
              {["Date", "Site", "Commodity", "Volume", "Price", "Counterparty", "Delivery Month", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {receipts.length > 0 ? receipts.map((r) => (
              <tr key={r.id} className="hover:bg-row-hover">
                <td className="px-4 py-2.5 text-xs font-mono tabular-nums text-muted">{r.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-2.5 font-medium text-secondary">{siteName(r.site_id)}</td>
                <td className="px-4 py-2.5 text-muted">{commodityName(r.commodity_id)}</td>
                <td className="px-4 py-2.5 tabular-nums text-secondary">{Number(r.volume).toLocaleString()}</td>
                <td className="px-4 py-2.5 tabular-nums text-secondary">
                  {r.price != null ? `$${Number(r.price).toFixed(4)}` : "\u2014"}
                </td>
                <td className="px-4 py-2.5 text-muted">{r.counterparty ?? "\u2014"}</td>
                <td className="px-4 py-2.5 font-mono text-muted">{r.delivery_month ?? "\u2014"}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-profit-10 text-profit">
                    received
                  </span>
                </td>
              </tr>
            )) : !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-faint">
                  No receipts yet. Receipts appear when physical buy contracts are filled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

