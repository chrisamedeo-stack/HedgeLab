import { queryOne } from "./db";

export interface FxConversionResult {
  amount: number | null;
  rate: number | null;
  rateDate: string | null;
  isStale: boolean;
  error?: string;
}

/** Convert an amount between currencies using the latest available FX rate */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOfDate?: string
): Promise<FxConversionResult> {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1, rateDate: asOfDate ?? new Date().toISOString().slice(0, 10), isStale: false };
  }

  const date = asOfDate ?? new Date().toISOString().slice(0, 10);

  // Try direct rate
  let row = await queryOne<{ rate: string; rate_date: string }>(
    `SELECT rate, rate_date FROM fx_rates
     WHERE from_currency = $1 AND to_currency = $2 AND rate_date <= $3
     ORDER BY rate_date DESC LIMIT 1`,
    [fromCurrency, toCurrency, date]
  );

  let rate: number | null = row ? parseFloat(row.rate) : null;
  let rateDate: string | null = row?.rate_date ?? null;

  // Try inverse rate
  if (rate === null) {
    row = await queryOne<{ rate: string; rate_date: string }>(
      `SELECT rate, rate_date FROM fx_rates
       WHERE from_currency = $1 AND to_currency = $2 AND rate_date <= $3
       ORDER BY rate_date DESC LIMIT 1`,
      [toCurrency, fromCurrency, date]
    );
    if (row) {
      rate = 1 / parseFloat(row.rate);
      rateDate = row.rate_date;
    }
  }

  if (rate === null) {
    return { amount: null, rate: null, rateDate: null, isStale: false, error: "No FX rate available" };
  }

  const converted = Math.round(amount * rate * 100) / 100;
  const daysDiff = rateDate
    ? Math.floor(
        (new Date(date).getTime() - new Date(rateDate).getTime()) / 86400000
      )
    : 0;

  return {
    amount: converted,
    rate,
    rateDate,
    isStale: daysDiff > 3,
  };
}

/** Get the latest FX rate between two currencies */
export async function getLatestRate(
  fromCurrency: string,
  toCurrency: string
): Promise<{ rate: number; date: string } | null> {
  if (fromCurrency === toCurrency) return { rate: 1, date: new Date().toISOString().slice(0, 10) };

  const row = await queryOne<{ rate: string; rate_date: string }>(
    `SELECT rate, rate_date FROM fx_rates
     WHERE from_currency = $1 AND to_currency = $2
     ORDER BY rate_date DESC LIMIT 1`,
    [fromCurrency, toCurrency]
  );

  if (row) return { rate: parseFloat(row.rate), date: row.rate_date };

  // Try inverse
  const inv = await queryOne<{ rate: string; rate_date: string }>(
    `SELECT rate, rate_date FROM fx_rates
     WHERE from_currency = $1 AND to_currency = $2
     ORDER BY rate_date DESC LIMIT 1`,
    [toCurrency, fromCurrency]
  );

  if (inv) return { rate: 1 / parseFloat(inv.rate), date: inv.rate_date };
  return null;
}
