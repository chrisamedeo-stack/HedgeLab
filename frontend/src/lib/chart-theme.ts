// Deep Sea Mystique palette (darkened ~15%)
// Core: Dark Navy #00324E → Pale Mint #8EC1BE
// Accents: Profit Green · Soft Red · Burnt Amber

export const chartTheme = {
  // Chrome
  grid:          "#00324E",    // Darkest navy — subtle grid lines
  tick:          "#8EC1BE",    // Pale mint — axis labels
  tooltipBg:     "#00324E",    // Darkest navy — tooltip background
  tooltipBorder: "#004D65",    // Deep teal — tooltip border
  tooltipText:   "#d0eeeb",    // Very light mint — tooltip text

  // Data series
  primary:   "#004D65",        // Deep teal — main bar
  accent:    "#8EC1BE",        // Pale mint — secondary / EFP
  hedged:    "#004D65",        // Deep teal — hedged volume (dark, solid)
  committed: "#00324E",        // Darkest navy — committed
  unhedged:  "#8EC1BE",        // Pale mint — gap

  // Coverage series
  board:     "#004D65",        // Deep teal — Board Price (futures + physical)
  basis:     "#009790",        // Teal — Basis locked (EFP)

  // Semantic — warm accents (unchanged)
  profit:  "#4caf50",          // Green 500 — positive P&L
  loss:    "#e57373",          // Red 300 — soft red, negative P&L
  warning: "#A66B17",          // Burnt Amber — alert
  orange:  "#A66B17",          // Burnt Amber
  budget:  "#A66B17",          // Burnt Amber — budget target line

  // Coverage chart specific
  basisRatio: "#007786",       // Ocean teal — basis/ratio bar
  forecast:   "#00324E",       // Darkest navy — unfixed forecast
  fixed:      "#009790",       // Teal — fixed price fill
  options:    "#ff8a65",       // Deep Orange 300 — options overlay (accent)
  budgetLine: "#8EC1BE",       // Pale mint — budget dashed line
} as const;

// Ordered palette for multi-series charts (max contrast between neighbours)
export const chartPalette = [
  "#004D65", // 1 — Deep teal (dark)
  "#8EC1BE", // 2 — Pale mint (light)
  "#00324E", // 3 — Darkest navy
  "#007786", // 4 — Ocean teal
  "#009790", // 5 — Teal
] as const;
