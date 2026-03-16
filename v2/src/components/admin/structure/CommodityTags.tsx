"use client";

import React from "react";
import { X } from "lucide-react";
import { apiFetch, selectCls } from "../shared";
import type { CommodityAssignment, InheritedCommodity } from "@/types/org";

interface Props {
  orgId: string;
  entityType: "org_unit" | "site";
  entityId: string;
  userId: string;
  allCommodities: { id: string; name: string }[];
  onChanged: () => void;
}

export function CommodityTags({ orgId, entityType, entityId, userId, allCommodities, onChanged }: Props) {
  const [direct, setDirect] = React.useState<CommodityAssignment[]>([]);
  const [inherited, setInherited] = React.useState<InheritedCommodity[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch(
        `/api/kernel/commodity-assignments?entityType=${entityType}&entityId=${entityId}`
      );
      setDirect(data.direct ?? []);
      setInherited(data.inherited ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  React.useEffect(() => { load(); }, [load]);

  const effectiveIds = new Set([
    ...direct.map((d) => d.commodity_id),
    ...inherited.map((i) => i.commodity_id),
  ]);
  const available = allCommodities.filter((c) => !effectiveIds.has(c.id));

  async function handleAdd(commodityId: string) {
    await apiFetch("/api/kernel/commodity-assignments", {
      method: "POST",
      body: JSON.stringify({ orgId, entityType, entityId, commodityId, userId }),
    });
    load();
    onChanged();
  }

  async function handleRemove(commodityId: string) {
    await apiFetch("/api/kernel/commodity-assignments", {
      method: "DELETE",
      body: JSON.stringify({ orgId, entityType, entityId, commodityId, userId }),
    });
    load();
    onChanged();
  }

  if (loading) return <div className="h-8 rounded bg-surface animate-pulse" />;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted uppercase tracking-wider">Commodities</h4>

      <div className="flex flex-wrap gap-1.5">
        {/* Direct tags */}
        {direct.map((d) => (
          <span
            key={d.commodity_id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-action/10 text-action border border-action/30 rounded-md"
          >
            {d.commodity_name}
            <button
              onClick={() => handleRemove(d.commodity_id)}
              className="hover:text-action/70 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Inherited tags */}
        {inherited.map((i) => (
          <span
            key={i.commodity_id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border border-dashed border-action/25 text-action/45 rounded-md"
            title={`Inherited from ${i.source_name} (${i.source_level})`}
          >
            {i.commodity_name}
            <span className="text-[10px] text-faint">via {i.source_name}</span>
          </span>
        ))}

        {direct.length === 0 && inherited.length === 0 && (
          <span className="text-xs text-faint">None assigned</span>
        )}
      </div>

      {/* Add dropdown */}
      {available.length > 0 && (
        <select
          className={selectCls + " w-auto text-xs"}
          value=""
          onChange={(e) => { if (e.target.value) handleAdd(e.target.value); }}
        >
          <option value="">+ Add commodity</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
