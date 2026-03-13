// ─── Shared UI class constants ───────────────────────────────────────────────
// Single source of truth for button, input, label, and title styling.
// Matches V1's corn-format.ts pattern.

// Inputs
export const inputCls =
  "bg-surface border border-b-input rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";
export const inputClsError =
  "bg-surface border border-destructive rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-destructive";
export const selectCls = inputCls;

// Full-width input variant (for forms that need w-full)
export const inputClsFull =
  "w-full bg-input-bg border border-b-input rounded-lg px-3 py-2.5 text-sm text-primary placeholder:text-ph focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent transition-colors";

// Buttons
export const btnPrimary =
  "flex items-center gap-2 px-4 py-2 bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors";
export const btnSecondary =
  "flex items-center gap-2 px-3 py-1.5 bg-input-bg hover:bg-hover border border-b-input text-secondary text-sm font-medium rounded-lg transition-colors";
export const btnCancel =
  "px-4 py-2 text-faint hover:text-secondary text-sm transition-colors";
export const btnDanger =
  "flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors";

// Labels
export const labelCls = "block text-xs font-medium text-muted mb-1";

// Titles
export const pageTitleCls = "text-xl font-bold text-primary";
export const pageSubtitleCls = "text-sm text-muted mt-0.5";
export const sectionTitleCls = "text-sm font-semibold text-secondary uppercase tracking-wider";

// Helpers
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
