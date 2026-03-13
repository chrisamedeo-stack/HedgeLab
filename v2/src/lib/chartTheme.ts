// ─── Centralized Chart Theme ─────────────────────────────────────────────────
// Matches globals.css design tokens. All chart components import from here.

export const chartColors = {
  chart1: "#00509e",   // Royal blue
  chart2: "#007acc",   // Ocean blue
  chart3: "#66a3ff",   // Cornflower
  chart4: "#cce0ff",   // Ice blue
  chart5: "#003366",   // Dark navy
  chart6: "#1a4d80",   // Mid-navy
  profit: "#4AAD8B",   // Jade green
  loss: "#D4645C",     // Terra cotta
  warning: "#66a3ff",  // Cornflower
  action: "#1383F4",   // Light blue
  muted: "#7B90AE",    // Sat 500
  faint: "#5C7495",    // Sat 600
  grid: "#1a4d80",     // Mid-navy grid lines
  tick: "#66a3ff",     // Cornflower axis labels
  tooltipBg: "#003366",     // Dark navy tooltip bg
  tooltipBorder: "#00509e", // Royal blue tooltip border
  tooltipText: "#cce0ff",   // Ice blue tooltip text
  surface: "#040C17",
  border: "#2B4362",
} as const;

export const chartTheme = {
  // Core chart assignments (V1 parity)
  primary: chartColors.chart1,    // Royal blue
  accent: chartColors.chart3,     // Cornflower
  board: chartColors.chart1,      // Royal blue
  basis: chartColors.chart3,      // Cornflower
  basisRatio: chartColors.chart2, // Ocean blue
  budget: chartColors.chart3,     // Cornflower
  budgetLine: chartColors.chart4, // Ice blue
  fixed: chartColors.profit,      // Jade green
  options: chartColors.chart3,    // Cornflower
  orange: chartColors.chart2,     // Ocean blue

  // Stacked bar colors — coverage
  committed: chartColors.chart5,
  hedged: chartColors.chart1,
  unhedged: chartColors.chart4,
  open: chartColors.chart4,
  budgeted: chartColors.chart3,
  forecast: "#003d7a",
  scenarioBase: "#5C7495",
  scenarioProjected: "#8b5cf6",

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

  // Forward curve
  forwardCurrent: chartColors.chart2,
  forwardCompare: chartColors.chart4,

  // Basis
  basisPositive: chartColors.profit,
  basisNegative: chartColors.chart2,

  // Waterfall
  waterfallTotal: chartColors.chart1,

  // Candlestick
  candleUp: "#22c55e",
  candleDown: "#ef4444",
  candleWick: "rgba(255,255,255,0.3)",

  // Counterparty palette
  counterparty: [
    "#007acc",
    "#00509e",
    "#66a3ff",
    "#003366",
    "#cce0ff",
    "#1a4d80",
    "#4A9DF7",
    "#0D4E8A",
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
