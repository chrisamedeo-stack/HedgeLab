// ─── Commodity Utilities ─────────────────────────────────────────────────────
// Data-driven versions of v1's commodity-utils, using API-loaded commodity configs
// instead of hardcoded values.

// Standard CME month code → month number mapping
const MONTH_CODE_MAP: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

// Reverse mapping: month number → code
const MONTH_NUM_TO_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(MONTH_CODE_MAP).map(([k, v]) => [v, k])
);

export interface CommodityConfig {
  id: string;
  name: string;
  contract_months?: string; // e.g., "HKNUZ"
  exchange?: string;
  config?: {
    month_mappings?: Record<string, number[]>;
    futures_prefix?: string;
    bushels_per_mt?: number;
  };
}

/**
 * Auto-suggest a futures month code for a given budget month.
 * Uses the commodity's contract_months and optional month_mappings from config.
 */
export function suggestFuturesMonth(
  commodity: CommodityConfig | null,
  budgetMonth: string
): string {
  if (!commodity || !budgetMonth || budgetMonth.length < 7) return "";

  const year = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const yy = (y: number) => String(y).slice(-2);
  const prefix = commodity.config?.futures_prefix ?? "";

  // If month_mappings exist, use them (maps contract code → budget months it covers)
  const mappings = commodity.config?.month_mappings;
  if (mappings) {
    for (const [code, months] of Object.entries(mappings)) {
      if (months.includes(month)) {
        const contractYear = month === 12 && months[0] === 12 && months.includes(1) ? year + 1 : year;
        return `${prefix}${code}${yy(contractYear)}`;
      }
    }
  }

  // Fallback: find the nearest contract month on or after the budget month
  const contractCodes = (commodity.contract_months || "").split("");
  const contractMonths = contractCodes
    .map((c) => ({ code: c, month: MONTH_CODE_MAP[c] }))
    .filter((x) => x.month != null)
    .sort((a, b) => a.month - b.month);

  if (contractMonths.length === 0) return "";

  // Find first contract month >= budget month
  const match = contractMonths.find((cm) => cm.month >= month);
  if (match) {
    return `${prefix}${match.code}${yy(year)}`;
  }
  // Wrap to first contract month of next year
  return `${prefix}${contractMonths[0].code}${yy(year + 1)}`;
}

/**
 * Generate all futures month codes for a commodity for the next N years.
 */
export function generateFuturesMonths(
  commodity: CommodityConfig | null,
  years = 3
): string[] {
  if (!commodity) return [];
  const prefix = commodity.config?.futures_prefix ?? "";
  const contractCodes = (commodity.contract_months || "").split("");
  const now = new Date();
  const currentYear = now.getFullYear();
  const yy = (y: number) => String(y).slice(-2);
  const months: string[] = [];

  for (let y = currentYear; y < currentYear + years; y++) {
    for (const code of contractCodes) {
      months.push(`${prefix}${code}${yy(y)}`);
    }
  }
  return months;
}
