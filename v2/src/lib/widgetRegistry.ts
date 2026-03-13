// ─── Widget Registry ──────────────────────────────────────────────────────────
// Defines all dashboard widgets, their plugin gates, supported drill levels, and sizes.

import type { DrillLevel, WidgetLayoutEntry } from "@/types/dashboard";

export type WidgetSize = "kpi-row" | "full" | "half";

export interface WidgetDefinition {
  id: string;
  label: string;
  defaultEnabled: boolean;
  pluginGate: string | null;  // null = always available
  supportedLevels: DrillLevel[];
  size: WidgetSize;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "kpi-coverage",       label: "Coverage KPIs",        defaultEnabled: true,  pluginGate: "budget",           supportedLevels: ["corporate", "unit", "site"], size: "kpi-row" },
  { id: "org-unit-cards",     label: "Organization Units",   defaultEnabled: true,  pluginGate: null,               supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "site-cards",         label: "Site Summary Cards",   defaultEnabled: true,  pluginGate: null,               supportedLevels: ["unit"],                      size: "full" },
  { id: "coverage-waterfall", label: "Coverage Waterfall",   defaultEnabled: true,  pluginGate: "budget",           supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "coverage-mini",      label: "Site Coverage Bars",   defaultEnabled: true,  pluginGate: "budget",           supportedLevels: ["corporate", "unit"],          size: "half" },
  { id: "underhedged-months", label: "Underhedged Months",   defaultEnabled: true,  pluginGate: "budget",           supportedLevels: ["corporate", "unit", "site"], size: "half" },
  { id: "expiring-positions", label: "Expiring Positions",   defaultEnabled: true,  pluginGate: "position_manager", supportedLevels: ["corporate", "unit", "site"], size: "half" },
  { id: "lifecycle-funnel",   label: "Position Lifecycle",   defaultEnabled: true,  pluginGate: "position_manager", supportedLevels: ["corporate", "unit"],          size: "half" },
  { id: "positions-by-month", label: "Positions by Month",   defaultEnabled: false, pluginGate: "position_manager", supportedLevels: ["corporate", "unit", "site"], size: "full" },
  { id: "forward-curve",      label: "Forward Curve",        defaultEnabled: false, pluginGate: "market_data",      supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "basis-charts",       label: "Basis Tracking",       defaultEnabled: false, pluginGate: "position_manager", supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "recent-trades",      label: "Recent Trades",        defaultEnabled: true,  pluginGate: "trade_capture",    supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "risk-kpis",          label: "Risk KPIs",            defaultEnabled: false, pluginGate: "risk",             supportedLevels: ["corporate", "unit"],          size: "kpi-row" },
  { id: "daily-pnl",          label: "Daily P&L Trend",      defaultEnabled: false, pluginGate: "risk",             supportedLevels: ["corporate", "unit"],          size: "full" },
  { id: "pnl-waterfall",      label: "P&L Waterfall",        defaultEnabled: false, pluginGate: "risk",             supportedLevels: ["corporate"],                  size: "full" },
  { id: "pnl-by-commodity",   label: "P&L by Commodity",     defaultEnabled: false, pluginGate: "risk",             supportedLevels: ["corporate"],                  size: "full" },
  { id: "alerts",             label: "Alerts & Warnings",    defaultEnabled: true,  pluginGate: null,               supportedLevels: ["corporate", "unit", "site"], size: "full" },
  { id: "site-monthly-detail",label: "Monthly Detail",       defaultEnabled: true,  pluginGate: "position_manager", supportedLevels: ["site"],                       size: "full" },
  { id: "site-all-in-summary",label: "All-In Summary",       defaultEnabled: true,  pluginGate: "position_manager", supportedLevels: ["site"],                       size: "full" },
];

/** Map widget ID → definition for fast lookup */
export const WIDGET_MAP = new Map(WIDGET_REGISTRY.map((w) => [w.id, w]));

/** Default layout derived from registry (all defaults on, ordered by registry position) */
export const DEFAULT_LAYOUT: WidgetLayoutEntry[] = WIDGET_REGISTRY.map((w, i) => ({
  widgetId: w.id,
  enabled: w.defaultEnabled,
  order: i,
}));

/**
 * Resolve a user's layout: user saved → org default → system default.
 * Auto-appends any new widgets not in the saved layout.
 */
export function resolveLayout(
  savedLayout: WidgetLayoutEntry[] | null | undefined,
): WidgetLayoutEntry[] {
  if (!savedLayout || savedLayout.length === 0) return DEFAULT_LAYOUT;

  const saved = new Map(savedLayout.map((e) => [e.widgetId, e]));
  const result = [...savedLayout];

  // Append any new widgets not in the saved layout
  let maxOrder = Math.max(...result.map((e) => e.order), -1);
  for (const w of WIDGET_REGISTRY) {
    if (!saved.has(w.id)) {
      result.push({ widgetId: w.id, enabled: w.defaultEnabled, order: ++maxOrder });
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

/**
 * Filter widgets for a given drill level and enabled plugins.
 */
export function getWidgetsForLevel(
  layout: WidgetLayoutEntry[],
  level: DrillLevel,
  isPluginEnabled: (pluginId: string) => boolean,
): WidgetLayoutEntry[] {
  return layout.filter((entry) => {
    if (!entry.enabled) return false;
    const def = WIDGET_MAP.get(entry.widgetId);
    if (!def) return false;
    if (!def.supportedLevels.includes(level)) return false;
    if (def.pluginGate && !isPluginEnabled(def.pluginGate)) return false;
    return true;
  });
}
