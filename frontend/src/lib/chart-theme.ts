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

  // Data series — blue scale (dark vs pale for max contrast)
  primary:   "#1565c0",       // Blue 800 — main bar
  accent:    "#90caf9",       // Blue 200 — secondary / EFP
  hedged:    "#1565c0",       // Blue 800 — hedged volume (dark, solid)
  committed: "#0d47a1",       // Blue 900 — committed (darkest)
  unhedged:  "#bbdefb",       // Blue 100 — gap (pale ice-blue, clearly lighter)

  // Coverage series
  board:     "#1565c0",       // Blue 800 — Board Price (futures + physical)
  basis:     "#4caf50",       // Green 500 — Basis locked (EFP)

  // Semantic — warm accents that pop against the blue family
  profit:  "#4caf50",         // Green 500 — positive P&L
  loss:    "#e57373",         // Red 300 — soft red, negative P&L
  warning: "#A66B17",         // Burnt Amber — alert
  orange:  "#A66B17",         // Burnt Amber
  budget:  "#A66B17",         // Burnt Amber — budget target line

  // Coverage chart specific
  basisRatio: "#42a5f5",       // Blue 400 — basis/ratio bar
  forecast:   "#0d47a1",       // Blue 900 — unfixed forecast
  fixed:      "#26a69a",       // Teal 400 — fixed price fill
  options:    "#ff8a65",       // Deep Orange 300 — options overlay
  budgetLine: "#90caf9",       // Blue 200 — budget dashed line
} as const;

// Ordered palette for multi-series charts (max contrast between neighbours)
export const chartPalette = [
  "#1565c0", // 1 — Blue 800 (dark)
  "#90caf9", // 2 — Blue 200 (light)
  "#0d47a1", // 3 — Deep Navy
  "#42a5f5", // 4 — Sky Blue
  "#1e88e5", // 5 — Blue 600
] as const;
