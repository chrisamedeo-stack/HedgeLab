// ─── Centralized Chart Theme ─────────────────────────────────────────────────
// Matches globals.css design tokens. All chart components import from here.

export const chartColors = {
  chart1: "#378ADD",   // Action blue
  chart2: "#6A9FCC",   // Basis blue
  chart3: "#1a6b7a",   // Board teal
  chart4: "#EF9F27",   // Budget amber
  chart5: "#1D9E75",   // Gain green
  chart6: "#D85A30",   // Loss orange
  profit: "#1D9E75",   // Gain green
  loss: "#D85A30",     // Loss orange
  warning: "#BA7517",  // Warning amber
  danger: "#E24B4A",   // Danger red
  action: "#378ADD",   // Action blue
  muted: "#8B95A5",    // Secondary text
  faint: "#556170",    // Faint text
  grid: "#1E3A5F",     // Border / grid lines
  tick: "#8B95A5",     // Axis labels
  tooltipBg: "#111D32",     // Surface tooltip bg
  tooltipBorder: "#1E3A5F", // Border tooltip border
  tooltipText: "#E8ECF1",   // Primary text tooltip
  surface: "#111D32",
  border: "#1E3A5F",
} as const;

export const chartTheme = {
  // Core chart assignments
  primary: chartColors.chart1,    // Action blue
  accent: chartColors.chart2,     // Basis blue
  board: chartColors.chart3,      // Board teal
  basis: chartColors.chart2,      // Basis blue
  basisRatio: chartColors.chart2, // Basis blue
  budget: chartColors.chart4,     // Budget amber
  budgetLine: chartColors.chart4, // Budget amber
  fixed: chartColors.profit,      // Gain green
  options: chartColors.chart2,    // Basis blue
  orange: chartColors.chart4,     // Budget amber

  // Stacked bar colors — coverage
  committed: chartColors.chart3,
  hedged: chartColors.chart1,
  unhedged: "rgba(181,212,244,0.22)",
  open: "rgba(181,212,244,0.22)",
  budgeted: chartColors.chart4,
  forecast: "rgba(181,212,244,0.1)",
  scenarioBase: "#556170",
  scenarioProjected: "#8b5cf6",

  // Position status colors
  statusOpen: chartColors.chart2,
  statusLocked: chartColors.chart1,
  statusOffset: chartColors.chart3,
  statusRolled: chartColors.muted,

  // Urgency
  urgencyCritical: chartColors.danger,
  urgencyUrgent: chartColors.warning,
  urgencyUpcoming: chartColors.muted,

  // P&L / Risk
  pnlPositive: chartColors.profit,
  pnlNegative: chartColors.loss,
  exposureLong: chartColors.chart1,
  exposureShort: chartColors.loss,
  exposureNet: chartColors.chart2,
  limitOk: chartColors.profit,
  limitWarning: chartColors.warning,
  limitBreached: chartColors.danger,

  // Forward curve
  forwardCurrent: chartColors.chart1,
  forwardCompare: chartColors.chart2,

  // Basis
  basisPositive: chartColors.profit,
  basisNegative: chartColors.loss,

  // Waterfall
  waterfallTotal: chartColors.chart1,

  // Candlestick
  candleUp: chartColors.profit,
  candleDown: chartColors.danger,
  candleWick: "rgba(255,255,255,0.3)",

  // Counterparty palette
  counterparty: [
    "#378ADD",
    "#6A9FCC",
    "#1a6b7a",
    "#EF9F27",
    "#1D9E75",
    "#D85A30",
    "#BA7517",
    "#5CA3E8",
  ] as readonly string[],
} as const;

export const tooltipStyle = {
  backgroundColor: chartColors.tooltipBg,
  border: `1px solid ${chartColors.tooltipBorder}`,
  borderRadius: "2px",
  color: chartColors.tooltipText,
  fontSize: 12,
} as const;

export const legendStyle = {
  fontSize: 11,
  color: chartColors.muted,
} as const;

export const axisStyle = {
  stroke: chartColors.tick,
  fontSize: 11,
  tickLine: false,
} as const;

/** Format large numbers as K (e.g. 12,500 → "12.5K") */
export function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
