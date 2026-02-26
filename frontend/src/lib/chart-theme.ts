// Budgeting Blues palette
// Core: Deep Navy #0d47a1 → Light Sky Blue #e1f5fe
// Accents: Profit Green · Soft Red · Burnt Amber

export const chartTheme = {
  // Chrome
  grid:          "#0a3d7a",
  tick:          "#64b5f6",
  tooltipBg:     "#082c5a",
  tooltipBorder: "#1565c0",
  tooltipText:   "#e1f5fe",

  // Data series — blue gradient
  primary:   "#1e88e5",       // Blue 600 — main bar
  accent:    "#64b5f6",       // Blue 300 — secondary / EFP
  hedged:    "#1e88e5",       // Blue 600 — hedged volume
  committed: "#0d47a1",       // Blue 900 — committed
  unhedged:  "#42a5f5",       // Blue 400 — gap

  // Semantic — warm accents that pop against the blue family
  profit:  "#4caf50",         // Green 500 — positive P&L
  loss:    "#e57373",         // Red 300 — soft red, negative P&L
  warning: "#A66B17",         // Burnt Amber — alert
  orange:  "#A66B17",         // Burnt Amber
  budget:  "#A66B17",         // Burnt Amber — budget target line
} as const;

// Ordered palette for multi-series charts
export const chartPalette = [
  "#1e88e5", // 1 — Blue 600 (vibrant)
  "#0d47a1", // 2 — Deep Navy
  "#42a5f5", // 3 — Sky Blue
  "#1565c0", // 4 — Blue 800
  "#64b5f6", // 5 — Blue 300
] as const;
