"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

interface ExportOption {
  label: string;
  path: string;
  filename: string;
  description: string;
}

const EXPORTS: ExportOption[] = [
  {
    label: "Trades CSV",
    path: "/api/v1/exports/trades.csv",
    filename: "trades.csv",
    description: "All trades matching the selected filters in CSV format",
  },
  {
    label: "Trades Excel",
    path: "/api/v1/exports/trades.xlsx",
    filename: "trades.xlsx",
    description: "Multi-sheet Excel with Trades, Delivery Schedules, Risk Metrics, and Summary tabs",
  },
  {
    label: "Audit Log CSV",
    path: "/api/v1/exports/audit-log.csv",
    filename: "audit-log.csv",
    description: "Full audit trail in CSV format (ADMIN only)",
  },
];

export default function ExportsPage() {
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [bookId, setBookId]   = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  function buildPath(basePath: string): string {
    const params = new URLSearchParams();
    if (from)   params.set("from", from);
    if (to)     params.set("to", to);
    if (bookId) params.set("bookId", bookId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  async function handleDownload(option: ExportOption) {
    setError(null);
    setLoading(option.label);
    try {
      const suffix = from || to ? `_${from || "all"}_to_${to || "now"}` : "";
      const ext    = option.filename.split(".").pop()!;
      const base   = option.filename.replace(`.${ext}`, "");
      await api.download(buildPath(option.path), `${base}${suffix}.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-blue-400" />
        <h1 className="text-xl font-bold text-slate-100">Exports</h1>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400">Export Filters (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Book ID (optional)</label>
            <input
              type="number"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              placeholder="Leave blank for all books"
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Export cards */}
      <div className="space-y-3">
        {EXPORTS.map((opt) => (
          <div
            key={opt.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-slate-200">{opt.label}</p>
              <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
            </div>
            <button
              onClick={() => handleDownload(opt)}
              disabled={loading === opt.label}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap ml-4 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {loading === opt.label ? "Downloading…" : "Download"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
