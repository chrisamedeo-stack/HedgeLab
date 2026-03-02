// Corporate Blues palette
// Core: Dark Navy #003366 → Ice Blue #cce0ff
// Accents: Jade Green · Terra Cotta · Sandy Gold

export const chartTheme = {
  // Chrome
  grid:          "#1a4d80",    // Mid-navy — visible grid lines
  tick:          "#66a3ff",    // Cornflower — axis labels
  tooltipBg:     "#003366",    // Dark navy — tooltip background
  tooltipBorder: "#00509e",    // Royal blue — tooltip border
  tooltipText:   "#cce0ff",    // Ice blue — tooltip text

  // Data series
  primary:   "#00509e",        // Royal blue — main bar
  accent:    "#66a3ff",        // Cornflower — secondary / EFP
  hedged:    "#00509e",        // Royal blue — hedged volume (dark, solid)
  committed: "#003366",        // Dark navy — committed
  unhedged:  "#cce0ff",        // Ice blue — gap

  // Coverage series
  board:     "#00509e",        // Royal blue — Board Price (futures + physical)
  basis:     "#66a3ff",        // Cornflower — Basis locked (EFP)

  // Semantic — warm accents (Coral & Jade)
  profit:  "#4AAD8B",          // Jade green — positive P&L
  loss:    "#D4645C",          // Terra cotta coral — negative P&L
  warning: "#D49A4E",          // Sandy gold — alert
  orange:  "#D49A4E",          // Sandy gold
  budget:  "#D49A4E",          // Sandy gold — budget target line

  // Coverage chart specific
  basisRatio: "#007acc",       // Ocean blue — basis/ratio bar
  forecast:   "#003d7a",       // Mid-dark navy — unfixed forecast (visible on dark bg)
  fixed:      "#4AAD8B",       // Jade green — fixed/hedged (safe)
  options:    "#ff8a65",       // Deep Orange 300 — options overlay (accent)
  budgetLine: "#cce0ff",       // Ice blue — budget dashed line
} as const;

// Ordered palette for multi-series charts (max contrast between neighbours)
export const chartPalette = [
  "#00509e", // 1 — Royal blue (dark)
  "#cce0ff", // 2 — Ice blue (light)
  "#003366", // 3 — Dark navy
  "#66a3ff", // 4 — Cornflower
  "#007acc", // 5 — Ocean blue
] as const;
