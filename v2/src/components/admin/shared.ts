import { API_BASE } from "@/lib/api";

// Re-export shared UI classes from centralized source
// Note: admin "btnCancel" was historically a bordered secondary button, not ghost text
import { btnPrimary as _btnPrimary, btnSecondary as _btnSecondary, btnDanger as _btnDanger, inputCls as _inputCls, selectCls as _selectCls, cn as _cn } from "@/lib/ui-classes";
export const btnPrimary = _btnPrimary;
export const btnCancel = _btnSecondary; // admin cancel = bordered secondary style
export const btnSecondary = _btnSecondary;
export const btnDanger = _btnDanger;
export const inputCls = _inputCls;
export const selectCls = _selectCls;
export const cn = _cn;

// ─── API Helper ──────────────────────────────────────────────────────────────

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
