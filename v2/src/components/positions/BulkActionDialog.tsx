"use client";

import { useState, useEffect } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import { usePmTradeStore } from "@/store/pmTradeStore";
import type { Portfolio, OrgNode } from "@/types/pm";

interface BulkActionDialogProps {
  action: string; // "define-site" | "define-budget-month" | "assign-portfolio"
  selectedIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkActionDialog({ action, selectedIds, onClose, onSuccess }: BulkActionDialogProps) {
  const { orgId } = useOrgContext();
  const { nodes, leafTier } = useOrgScope();
  const { bulkAction } = usePmTradeStore();

  const [value, setValue] = useState("");
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leaf nodes for site picker
  const leafNodes = nodes.filter((n) => !nodes.some((other) => other.parent_id === n.id));

  useEffect(() => {
    if (action === "assign-portfolio") {
      fetch(`/api/pm/portfolios?orgId=${orgId}`)
        .then((r) => r.json())
        .then((data) => setPortfolios(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [orgId, action]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (action === "define-site") payload.siteId = value;
      if (action === "define-budget-month") payload.budgetMonth = value;
      if (action === "assign-portfolio") payload.portfolioId = value;

      const updated = await bulkAction(action, selectedIds, orgId, payload);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    action === "define-site" ? `Define ${leafTier?.tier_name ?? "Site"}` :
    action === "define-budget-month" ? "Define Budget Month" :
    "Assign Portfolio";

  const inputClass = "w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none";

  return (
    <div className="rounded-lg border border-action-20 bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-primary">
          {title}
          <span className="ml-2 text-xs font-normal text-muted">({selectedIds.length} selected)</span>
        </h4>
        <button onClick={onClose} className="text-faint hover:text-primary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-destructive-5 border border-destructive-20 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          {action === "define-site" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} required>
              <option value="">Select {leafTier?.tier_name ?? "Site"}...</option>
              {leafNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}{n.code ? ` (${n.code})` : ""}</option>
              ))}
            </select>
          )}

          {action === "define-budget-month" && (
            <input type="month" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} required />
          )}

          {action === "assign-portfolio" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} required>
              <option value="">Select Portfolio...</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !value}
          className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {submitting ? "Applying..." : "Apply"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm text-secondary hover:text-primary transition-colors"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
