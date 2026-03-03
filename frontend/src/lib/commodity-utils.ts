import type { CommodityConfig } from "@/lib/commodity-config";

/** Map a budget month (YYYY-MM) to the matching futures month code for a given commodity */
export function suggestFuturesMonth(config: CommodityConfig, budgetMonth: string): string {
  if (!budgetMonth || budgetMonth.length < 7) return "";
  const year = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const yy = (y: number) => String(y).slice(-2);

  for (const [code, months] of Object.entries(config.monthMappings)) {
    if (months.includes(month)) {
      // If Dec is mapped to a contract, the contract year is the next year
      const contractYear = month === 12 && months[0] === 12 && months.includes(1) ? year + 1 : year;
      return `${config.futuresPrefix}${code}${yy(contractYear)}`;
    }
  }
  // Fallback: first contract month of the next year
  const firstMonth = config.contractMonths[0];
  return `${config.futuresPrefix}${firstMonth}${yy(year + 1)}`;
}

/** Given a futures month code, return the valid delivery months for any commodity */
export function getValidDeliveryMonths(config: CommodityConfig, futuresMonth: string): string[] {
  if (!futuresMonth || futuresMonth.length < config.futuresPrefix.length + 3) return [];
  const upper = futuresMonth.toUpperCase();
  if (!upper.startsWith(config.futuresPrefix)) return [];
  const mc = upper[config.futuresPrefix.length];
  const yearStr = upper.slice(config.futuresPrefix.length + 1);
  const year = 2000 + parseInt(yearStr, 10);
  if (isNaN(year)) return [];

  const pad = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const mapped = config.monthMappings[mc];
  if (!mapped) return [];

  return mapped.map((m) => {
    // Months that belong to the previous year (e.g., Dec in March contract)
    const y = m >= 11 && mapped.includes(1) ? year - 1 : year;
    return pad(y, m);
  });
}

/** Generate all futures month codes for the next N years */
export function generateFuturesMonths(config: CommodityConfig, years = 3): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const months: string[] = [];
  const yy = (y: number) => String(y).slice(-2);
  for (let y = currentYear; y < currentYear + years; y++) {
    for (const mc of config.contractMonths) {
      months.push(`${config.futuresPrefix}${mc}${yy(y)}`);
    }
  }
  return months;
}
