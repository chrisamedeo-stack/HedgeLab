"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { useOrgContext } from "@/contexts/OrgContext";

interface AuditEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  module: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before_state: unknown;
  after_state: unknown;
  source: string | null;
  ip_address: string | null;
  created_at: string;
}

const actionStyles: Record<string, string> = {
  create:       "bg-profit-10 text-profit",
  update:       "bg-action-10 text-action",
  delete:       "bg-destructive-10 text-destructive",
  submit:       "bg-warning-10 text-warning",
  approve:      "bg-profit-10 text-profit",
  lock:         "bg-action-10 text-action",
  unlock:       "bg-warning-10 text-warning",
  restore:      "bg-accent-10 text-accent",
  allocate:     "bg-action-10 text-action",
  efp:          "bg-profit-10 text-profit",
  offset:       "bg-warning-10 text-warning",
  roll:         "bg-accent-10 text-accent",
  cancel:       "bg-destructive-10 text-destructive",
};

const MODULES = ["", "budget", "position", "trade", "market", "kernel"];

export default function AuditPage() {
  const { orgId } = useOrgContext();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ orgId });
      if (moduleFilter) params.set("module", moduleFilter);
      const res = await fetch(`${API_BASE}/api/v2/kernel/audit?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, orgId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const paged = entries.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Audit Log</h1>
          <p className="mt-0.5 text-xs text-faint">Review all system actions and data changes</p>
        </div>
        <span className="text-sm text-faint">{entries.length} entries</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={moduleFilter}
          onChange={(e) => { setModuleFilter(e.target.value); setPage(0); }}
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
        >
          {MODULES.map((m) => (
            <option key={m} value={m}>{m || "All modules"}</option>
          ))}
        </select>
      </div>

      {loading && entries.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading audit log...</div>
      )}

      {/* Table */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-input-bg/50 border-b border-b-default">
            <tr>
              {["When", "Module", "Entity", "ID", "Action", "Source", "User"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {paged.length > 0 ? paged.map((entry) => (
              <tr key={entry.id} className="hover:bg-row-hover">
                <td className="px-4 py-2.5 text-xs font-mono tabular-nums text-muted whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-muted">{entry.module}</td>
                <td className="px-4 py-2.5 text-muted">{entry.entity_type}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-faint">{entry.entity_id?.slice(0, 8) ?? "\u2014"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${actionStyles[entry.action] ?? "bg-hover text-muted"}`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-faint">{entry.source ?? "\u2014"}</td>
                <td className="px-4 py-2.5 text-muted font-mono text-xs">{entry.user_id?.slice(0, 8) ?? "system"}</td>
              </tr>
            )) : !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-faint">No audit entries</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 items-center">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-b-input text-secondary rounded-lg disabled:opacity-40 hover:bg-input-bg transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-faint">{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-b-input text-secondary rounded-lg disabled:opacity-40 hover:bg-input-bg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
