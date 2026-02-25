// StoneX Digital Style Guide — chart colour tokens
export const chartTheme = {
  grid: "#1A2E49",        // Sat 900
  tick: "#5C7495",        // Sat 600
  tooltipBg: "#0D1C30",   // Sat 1000
  tooltipBorder: "#2B4362",// Sat 800
  tooltipText: "#F3F8FE",  // Sat 50
  profit: "#38A236",       // Green 400
  loss: "#EB0000",         // Red 500
  primary: "#1383F4",      // Light Blue
  accent: "#B3C0D3",       // Sat 300 — visible in charts
  warning: "#F29E1A",      // Orange 500
  orange: "#F5B148",       // Orange 400
  unhedged: "#2B4362",     // Sat 800
  committed: "#1383F4",    // Light Blue
  hedged: "#38A236",       // Green 400
  budget: "#F29E1A",       // Orange 500
} as const;
