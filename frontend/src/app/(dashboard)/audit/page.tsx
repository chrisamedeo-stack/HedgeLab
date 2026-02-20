"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { AuditLog, Page } from "@/types/audit";
import { ScrollText } from "lucide-react";

const ENTITY_TYPES = ["", "Trade", "Invoice", "Counterparty", "System"];

const actionStyles: Record<string, string> = {
  CREATE:       "bg-emerald-500/10 text-emerald-400",
  UPDATE:       "bg-blue-500/10 text-blue-400",
  DELETE:       "bg-red-500/10 text-red-400",
  STATE_CHANGE: "bg-amber-500/10 text-amber-400",
  AMEND:        "bg-purple-500/10 text-purple-400",
  DELIVER:      "bg-cyan-500/10 text-cyan-400",
  SCHEDULE_RUN: "bg-slate-700 text-slate-400",
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
          <ScrollText className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">Audit Log</h1>
        </div>
        <span className="text-sm text-slate-500">{data?.totalElements ?? 0} entries</span>
      </div>

      <div className="flex gap-3">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t || "All entity types"}</option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 border-b border-slate-800">
            <tr>
              {["When", "By", "Entity", "ID", "Action", "Summary"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data?.content.length ? data.content.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-2.5 text-xs font-mono text-slate-400 whitespace-nowrap">
                  {new Date(entry.performedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-300">{entry.performedBy}</td>
                <td className="px-4 py-2.5 text-slate-400">{entry.entityType}</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{entry.entityId ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    actionStyles[entry.action] ?? "bg-slate-700 text-slate-400"
                  }`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">
                  {entry.changeSummary ?? "—"}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No audit entries</td>
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
            className="px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-500">{page + 1} / {data.totalPages}</span>
          <button
            disabled={page >= data.totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
