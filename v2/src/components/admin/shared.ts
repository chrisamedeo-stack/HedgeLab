import { API_BASE } from "@/lib/api";

// ─── Style constants ─────────────────────────────────────────────────────────

export const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50";
export const btnCancel = "inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input";
export const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
export const selectCls = inputCls;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}
