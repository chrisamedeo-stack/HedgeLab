/** Compact axis formatter — abbreviates to K/M for chart Y-axes only */
export function fmtK(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${Math.round(n / 1_000)}K`
    : String(Math.round(n));
}
