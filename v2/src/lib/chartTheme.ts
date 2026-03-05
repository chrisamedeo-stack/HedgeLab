// ─── Centralized Chart Theme ─────────────────────────────────────────────────
// Matches globals.css design tokens. All chart components import from here.

export const chartColors = {
  chart1: "#00509e",
  chart2: "#007acc",
  chart3: "#66a3ff",
  chart4: "#cce0ff",
  chart5: "#003366",
  chart6: "#D49A4E",
  profit: "#4AAD8B",
  loss: "#D4645C",
  warning: "#D49A4E",
  action: "#1383F4",
  muted: "#7B90AE",
  faint: "#5C7495",
  grid: "#1A2A40",
  surface: "#040C17",
  border: "#2B4362",
} as const;

export const chartTheme = {
  // Stacked bar colors — coverage
  committed: chartColors.chart2,
  hedged: chartColors.chart1,
  open: chartColors.chart6,
  budgeted: chartColors.chart3,
  forecast: "#8b5cf6",

  // Position status colors
  statusOpen: chartColors.chart3,
  statusLocked: chartColors.chart2,
  statusOffset: chartColors.chart5,
  statusRolled: chartColors.muted,

  // Urgency
  urgencyCritical: chartColors.loss,
  urgencyUrgent: chartColors.warning,
  urgencyUpcoming: chartColors.muted,

  // P&L / Risk
  pnlPositive: chartColors.profit,
  pnlNegative: chartColors.loss,
  exposureLong: "#007acc",
  exposureShort: "#D4645C",
  exposureNet: "#66a3ff",
  limitOk: chartColors.profit,
  limitWarning: chartColors.warning,
  limitBreached: chartColors.loss,

  // Counterparty palette
  counterparty: [
    "#007acc",
    "#4AAD8B",
    "#D49A4E",
    "#8b5cf6",
    "#D4645C",
    "#66a3ff",
    "#00509e",
    "#cce0ff",
  ] as readonly string[],
} as const;

export const tooltipStyle = {
  backgroundColor: chartColors.surface,
  border: `1px solid ${chartColors.border}`,
  borderRadius: "2px",
  fontSize: 12,
} as const;

export const legendStyle = {
  fontSize: 11,
  color: chartColors.muted,
} as const;

export const axisStyle = {
  stroke: chartColors.faint,
  fontSize: 11,
  tickLine: false,
} as const;

/** Format large numbers as K (e.g. 12,500 → "12.5K") */
export function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
