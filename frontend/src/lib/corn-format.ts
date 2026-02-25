import { BUSHELS_PER_MT } from "@/lib/corn-utils";

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** Format a volume for display in bushels. If sourceUnit is "MT", converts to BU automatically. */
export function fmtVol(value: number | null | undefined, sourceUnit: "MT" | "BU" = "BU"): string {
  if (value == null) return "\u2013";
  const bu = sourceUnit === "MT" ? value * BUSHELS_PER_MT : value;
  return bu.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmt2(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtBu(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmtPnl(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "\u2212";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return `$${fmt2(n)}`;
}

export function fmtPerBu(val: number | null | undefined): string {
  if (val == null) return "\u2013";
  return val.toFixed(4);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function pnlColor(n: number | null | undefined): string {
  if (n == null || n === 0) return "text-zinc-400";
  return n > 0 ? "text-emerald-400" : "text-red-400";
}

// ─── Shared CSS constants ────────────────────────────────────────────────────

export const inputCls =
  "bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500";

export const btnPrimary =
  "px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50";

export const btnSecondary =
  "px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm rounded-lg font-medium";

export const inputClsError =
  "bg-zinc-900 border border-red-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500";
