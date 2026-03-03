/** Format a volume for display in bushels, with commodity-specific MT→BU conversion */
export function fmtVol(
  value: number | null | undefined,
  bushelsPerMt: number,
  sourceUnit: "MT" | "BU" = "BU"
): string {
  if (value == null) return "\u2013";
  const bu = sourceUnit === "MT" ? value * bushelsPerMt : value;
  return bu.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
