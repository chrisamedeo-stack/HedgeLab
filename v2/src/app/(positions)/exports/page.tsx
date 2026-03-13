"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";
import { useOrgContext } from "@/contexts/OrgContext";

interface ExportOption {
  label: string;
  endpoint: string;
  filename: string;
  description: string;
}

const EXPORTS: ExportOption[] = [
  {
    label: "Hedge Book CSV",
    endpoint: "/api/positions/hedge-book",
    filename: "hedge-book.csv",
    description: "All open and closed allocations in the hedge book",
  },
  {
    label: "Physical Contracts CSV",
    endpoint: "/api/positions/physicals",
    filename: "physical-contracts.csv",
    description: "All physical buy/sell contracts",
  },
  {
    label: "Trade Blotter CSV",
    endpoint: "/api/trades",
    filename: "trades.csv",
    description: "All financial trades — futures, options, swaps",
  },
  {
    label: "Budget Periods CSV",
    endpoint: "/api/budget/periods",
    filename: "budget-periods.csv",
    description: "All budget periods with line item summaries",
  },
  {
    label: "Coverage Summary CSV",
    endpoint: "/api/budget/coverage",
    filename: "coverage-summary.csv",
    description: "Monthly coverage breakdown — budgeted, committed, hedged, open",
  },
  {
    label: "Audit Log CSV",
    endpoint: "/api/kernel/audit",
    filename: "audit-log.csv",
    description: "Full audit trail of all system actions (Admin only)",
  },
];

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val == null ? "" : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export default function ExportsPage() {
  const { orgId } = useOrgContext();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(option: ExportOption) {
    setError(null);
    setLoading(option.label);
    try {
      const params = new URLSearchParams({ orgId });
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const res = await fetch(`${API_BASE}${option.endpoint}?${params}`);
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const data = await res.json();

      // Handle nested structures
      let rows: Record<string, unknown>[];
      if (Array.isArray(data)) {
        rows = data;
      } else if (data.entries && Array.isArray(data.entries)) {
        rows = data.entries;
      } else if (data.byMonth && Array.isArray(data.byMonth)) {
        rows = data.byMonth;
      } else {
        rows = [data];
      }

      const csv = jsonToCsv(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = from || to ? `_${from || "all"}_to_${to || "now"}` : "";
      a.download = option.filename.replace(".csv", `${suffix}.csv`);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-xl font-bold text-primary">Exports</h1>
        <p className="text-sm text-muted mt-0.5">Download position data and reports</p>
      </div>

      {/* Date filters */}
      <div className="bg-surface border border-b-default rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted">Export Filters (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-faint mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-faint mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive-10 border border-destructive-30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Export cards */}
      <div className="space-y-3">
        {EXPORTS.map((opt) => (
          <div
            key={opt.label}
            className="bg-surface border border-b-default rounded-lg p-5 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-secondary">{opt.label}</p>
              <p className="text-sm text-faint mt-0.5">{opt.description}</p>
            </div>
            <button
              onClick={() => handleDownload(opt)}
              disabled={loading === opt.label}
              className="flex items-center gap-2 whitespace-nowrap ml-4 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {loading === opt.label ? "Downloading\u2026" : "Download"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
