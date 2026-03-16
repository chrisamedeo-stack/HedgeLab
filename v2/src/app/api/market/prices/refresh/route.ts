import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { queryAll, queryOne } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommodityRow {
  id: string;
  contract_months: string | null;
  config: { futures_prefix?: string } | null;
}

// CME month letter → month number
const LETTER_TO_MONTH: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

// HedgeLab commodity ID → CommodityPriceAPI symbol
const API_SYMBOL_MAP: Record<string, string> = {
  CORN: "CORN",
  SOYBEAN: "SOYBEAN-FUT",
  WHEAT: "ZW-FUT",
  SOYOIL: "ZL",
  SOYMEAL: "ZM",
};

// ─── Front-month logic ───────────────────────────────────────────────────────

function getFrontMonth(date: Date, contractMonths: string, prefix: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const letters = contractMonths.split("");

  for (const yr of [year, year + 1]) {
    for (const letter of letters) {
      const contractMonth = LETTER_TO_MONTH[letter];
      const expiryDay = 14;
      if (yr > year || contractMonth > month || (contractMonth === month && day <= expiryDay)) {
        const yrStr = String(yr).slice(-2);
        return `${prefix}${letter}${yrStr}`;
      }
    }
  }

  const firstLetter = letters[0];
  return `${prefix}${firstLetter}${String(year + 1).slice(-2)}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    await requirePlugin(user.orgId, "market_data");
    await requirePermission(user.id, "market.enter_price");

    const apiKey = process.env.COMMODITY_PRICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "COMMODITY_PRICE_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Optional body params: { days?: number }
    let days = 1;
    try {
      const body = await request.json();
      if (body.days && typeof body.days === "number" && body.days > 0) {
        days = Math.min(body.days, 30); // cap at 30 to avoid abuse
      }
    } catch {
      // No body or invalid JSON — default to 1 day
    }

    // Get commodities from database for prefix + contract_months
    const commodities = await queryAll<CommodityRow>(
      `SELECT id, contract_months, config FROM commodities WHERE org_id = $1`,
      [user.orgId]
    );

    // Build date list (weekdays going back from yesterday)
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; dates.length < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (isWeekday(d)) dates.push(d);
      if (i > days + 10) break; // safety
    }
    dates.reverse();

    // Build API symbol list and reverse map
    const reverseMap: Record<string, { commodityId: string; contractMonths: string; prefix: string }> = {};
    const apiSymbols: string[] = [];

    for (const c of commodities) {
      const apiSymbol = API_SYMBOL_MAP[c.id];
      if (!apiSymbol || !c.contract_months) continue;
      const prefix = c.config?.futures_prefix ?? "";
      reverseMap[apiSymbol] = { commodityId: c.id, contractMonths: c.contract_months, prefix };
      apiSymbols.push(apiSymbol);
    }

    if (apiSymbols.length === 0) {
      return NextResponse.json({ upserted: 0, message: "No commodities with API mappings" });
    }

    let upserted = 0;
    let errors = 0;

    for (const date of dates) {
      const dateStr = formatDate(date);
      try {
        const url = `https://api.commoditypriceapi.com/v2/rates/historical?apiKey=${apiKey}&symbols=${apiSymbols.join(",")}&date=${dateStr}`;
        const res = await fetch(url);
        if (!res.ok) { errors++; continue; }

        const data = await res.json();
        if (!data.success || !data.rates) { errors++; continue; }

        for (const [apiSymbol, priceData] of Object.entries(data.rates)) {
          const info = reverseMap[apiSymbol];
          if (!info) continue;

          const pd = priceData as { close?: number; open?: number; high?: number; low?: number };
          if (pd.close === undefined) continue;

          const contractMonth = getFrontMonth(date, info.contractMonths, info.prefix);

          await queryOne(
            `INSERT INTO md_prices
               (org_id, commodity_id, contract_month, price_date, price_type,
                price, open_price, high_price, low_price, source)
             VALUES ($1, $2, $3, $4, 'settlement', $5, $6, $7, $8, 'commodity-price-api')
             ON CONFLICT (org_id, commodity_id, contract_month, price_date, price_type)
             DO UPDATE SET price = EXCLUDED.price,
                           open_price = EXCLUDED.open_price,
                           high_price = EXCLUDED.high_price,
                           low_price = EXCLUDED.low_price
             RETURNING id`,
            [
              user.orgId,
              info.commodityId,
              contractMonth,
              dateStr,
              pd.close,
              pd.open ?? null,
              pd.high ?? null,
              pd.low ?? null,
            ]
          );
          upserted++;
        }
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ upserted, errors, days: dates.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[market/prices/refresh] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
