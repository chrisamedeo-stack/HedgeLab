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
  price_unit?: string;
  volume_unit?: string;
  contract_months?: string; // e.g., "HKNUZ"
  exchange?: string;
  config?: {
    month_mappings?: Record<string, number[]>;
    futures_prefix?: string;
    units_per_mt?: number;
    /** @deprecated Use units_per_mt instead */
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
 * Parse a CME futures code (e.g., "ZCH27") into human-readable format ("Mar-2027").
 * Returns original code as fallback if unparseable.
 */
export function formatContractMonth(code: string | null | undefined): string {
  if (!code) return "—";
  // Extract month letter (third-to-last) and 2-digit year (last 2)
  const match = code.match(/([A-Z])(\d{2})$/);
  if (!match) return code;
  const [, monthLetter, yy] = match;
  const monthNum = MONTH_CODE_MAP[monthLetter];
  if (monthNum == null) return code;
  const fullYear = 2000 + Number(yy);
  const date = new Date(fullYear, monthNum - 1, 1);
  const mon = date.toLocaleDateString("en-US", { month: "short" });
  return `${mon}-${fullYear}`;
}

/**
 * Generate an array of "YYYY-MM" strings from start to end (inclusive).
 * E.g. generateMonthRange("2026-01", "2026-04") → ["2026-01","2026-02","2026-03","2026-04"]
 */
export function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format "2026-03" → "Mar 26"
 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

/**
 * Format "2026-07" → "Jul 2026"
 */
export function formatDeliveryMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${y}`;
}

/**
 * Get contract month options for dropdowns and pills.
 * Returns [{ value: "ZCN26", label: "Jul-26" }, ...] from commodity config.
 */
export function getContractMonthOptions(
  commodity: CommodityConfig | null,
  yearsAhead = 3
): { value: string; label: string }[] {
  if (!commodity) return [];
  const prefix = commodity.config?.futures_prefix ?? "";
  const contractCodes = (commodity.contract_months || "").split("");
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const yy = (y: number) => String(y).slice(-2);
  const options: { value: string; label: string }[] = [];

  for (let y = currentYear; y < currentYear + yearsAhead; y++) {
    for (const code of contractCodes) {
      const monthNum = MONTH_CODE_MAP[code];
      if (monthNum == null) continue;
      if (y === currentYear && monthNum < currentMonth) continue;
      options.push({
        value: `${prefix}${code}${yy(y)}`,
        label: `${SHORT_MONTHS[monthNum - 1]}-${yy(y)}`,
      });
    }
  }
  return options;
}

/**
 * Generate all futures month codes for a commodity for the next N years.
 * Filters out months that have already passed.
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
  const currentMonth = now.getMonth() + 1; // 1-based
  const yy = (y: number) => String(y).slice(-2);
  const months: string[] = [];

  for (let y = currentYear; y < currentYear + years; y++) {
    for (const code of contractCodes) {
      const monthNum = MONTH_CODE_MAP[code];
      if (monthNum == null) continue;
      // Skip past months
      if (y === currentYear && monthNum < currentMonth) continue;
      months.push(`${prefix}${code}${yy(y)}`);
    }
  }
  return months;
}
