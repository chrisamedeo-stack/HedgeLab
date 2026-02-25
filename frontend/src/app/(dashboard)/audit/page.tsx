"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { AuditLog, Page } from "@/types/audit";
import { ScrollText } from "lucide-react";

const ENTITY_TYPES = ["", "Trade", "Invoice", "Counterparty", "System"];

const actionStyles: Record<string, string> = {
  CREATE:       "bg-profit-10 text-profit",
  UPDATE:       "bg-action-10 text-action",
  DELETE:       "bg-destructive-10 text-destructive",
  STATE_CHANGE: "bg-warning-10 text-warning",
  AMEND:        "bg-accent-10 text-accent",
  DELIVER:      "bg-action-10 text-action",
  SCHEDULE_RUN: "bg-hover text-muted",
};

export default function AuditPage() {
  const [page, setPage]             = useState(0);
  const [entityType, setEntityType] = useState("");

  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (entityType) params.set("entityType", entityType);

  const { data } = useSWR<Page<AuditLog>>(
    `/api/v1/audit?${params}`,
    (url: string) => api.get<Page<AuditLog>>(url),
    { refreshInterval: 30_000 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-action" />
          <h1 className="text-xl font-bold text-primary">Audit Log</h1>
        </div>
        <span className="text-sm text-faint">{data?.totalElements ?? 0} entries</span>
      </div>

      <div className="flex gap-3">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t || "All entity types"}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-input-bg/50 border-b border-b-default">
            <tr>
              {["When", "By", "Entity", "ID", "Action", "Summary"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {data?.content.length ? data.content.map((entry) => (
              <tr key={entry.id} className="hover:bg-row-hover">
                <td className="px-4 py-2.5 text-xs font-mono tabular-nums text-muted whitespace-nowrap">
                  {new Date(entry.performedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-secondary">{entry.performedBy}</td>
                <td className="px-4 py-2.5 text-muted">{entry.entityType}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-faint">{entry.entityId ?? "\u2014"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    actionStyles[entry.action] ?? "bg-hover text-muted"
                  }`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-faint max-w-xs truncate">
                  {entry.changeSummary ?? "\u2014"}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-faint">No audit entries</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2 items-center">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-b-input text-secondary rounded-lg disabled:opacity-40 hover:bg-input-bg transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-faint">{page + 1} / {data.totalPages}</span>
          <button
            disabled={page >= data.totalPages - 1}
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
