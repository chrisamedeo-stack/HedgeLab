// ─── Shared Corn Utilities ──────────────────────────────────────────────────

export const BUSHELS_PER_MT = 39.3683;

/** Map a budget month (YYYY-MM) to the corresponding ZC futures month code */
export function suggestFuturesMonth(budgetMonth: string): string {
  if (!budgetMonth || budgetMonth.length < 7) return "";
  const year  = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const yy = (y: number) => String(y).slice(-2);
  if (month <= 2)  return `ZCH${yy(year)}`;
  if (month <= 4)  return `ZCK${yy(year)}`;
  if (month <= 6)  return `ZCN${yy(year)}`;
  if (month <= 8)  return `ZCU${yy(year)}`;
  if (month <= 11) return `ZCZ${yy(year)}`;
  return `ZCH${yy(year + 1)}`;
}

/** Given a ZC futures month code, return the valid delivery months */
export function getValidDeliveryMonths(futuresMonth: string): string[] {
  if (!futuresMonth || futuresMonth.length < 5) return [];
  const upper = futuresMonth.toUpperCase();
  if (!upper.startsWith("ZC")) return [];
  const mc = upper[2];
  const year = 2000 + parseInt(upper.slice(3), 10);
  if (isNaN(year)) return [];
  const pad = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  switch (mc) {
    case "H": return [pad(year - 1, 12), pad(year, 1), pad(year, 2)];
    case "K": return [pad(year, 3), pad(year, 4)];
    case "N": return [pad(year, 5), pad(year, 6)];
    case "U": return [pad(year, 7), pad(year, 8)];
    case "Z": return [pad(year, 9), pad(year, 10), pad(year, 11)];
    default: return [];
  }
}

/** Derive fiscal year string (e.g. "2025/2026") from a budget month */
export function deriveFiscalYear(budgetMonth: string, fyStartMonth = 7): string {
  if (!budgetMonth) return "";
  const year  = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const start = month >= fyStartMonth ? year : year - 1;
  return `${start}/${start + 1}`;
}

/** All 12 months of a fiscal year as YYYY-MM strings */
export function fiscalYearMonths(fy: string, fyStartMonth = 7): string[] {
  if (!fy.includes("/")) return [];
  const sy = parseInt(fy.split("/")[0]);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((fyStartMonth - 1 + i) % 12) + 1;
    const y = m >= fyStartMonth ? sy : sy + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

/** Generate a list of fiscal year strings around the current year */
export function availableFiscalYears(fyStartMonth = 7): string[] {
  const now = new Date();
  const y = now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 7 }, (_, i) => `${y - 2 + i}/${y - 1 + i}`);
}

/** Current fiscal year string */
export function currentFiscalYear(fyStartMonth: number): string {
  const now = new Date();
  const y = now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

/** Generate all YYYY-MM strings from start to end inclusive */
export function generateMonthRange(start: string, end: string): string[] {
  if (!start || !end || start.length < 7 || end.length < 7) return [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/** Format YYYY-MM as a short label like "Jan '26" */
export function monthLabel(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
}
