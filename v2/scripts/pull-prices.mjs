#!/usr/bin/env node
/**
 * Pull historical commodity prices from CommodityPriceAPI
 * and insert into md_prices table.
 *
 * Usage: node scripts/pull-prices.mjs [--days=365] [--dry-run]
 */

import pg from "pg";
const { Pool } = pg;

// ─── Config ─────────────────────────────────────────────────────────────────

const API_KEY = process.env.COMMODITY_PRICE_API_KEY;
if (!API_KEY) {
  console.error("Missing COMMODITY_PRICE_API_KEY env var. Set it in .env.local");
  process.exit(1);
}
const API_BASE = "https://api.commoditypriceapi.com/v2/rates";
const ORG_ID = "00000000-0000-0000-0000-000000000001"; // HedgeLab Demo

// Map HedgeLab commodity IDs → API symbols + futures prefix for canonical contract_month format
const COMMODITY_MAP = {
  CORN:    { apiSymbol: "CORN",         contractMonths: "HKNUZ",    prefix: "ZC" },
  SOYBEAN: { apiSymbol: "SOYBEAN-FUT",  contractMonths: "FHKNQUX",  prefix: "ZS" },
  WHEAT:   { apiSymbol: "ZW-FUT",       contractMonths: "HKNUZ",    prefix: "ZW" },
  SOYOIL:  { apiSymbol: "ZL",           contractMonths: "FHKNQUVZ", prefix: "ZL" },
  SOYMEAL: { apiSymbol: "ZM",           contractMonths: "FHKNQUVZ", prefix: "ZM" },
};

// Futures letter → calendar month number
const LETTER_TO_MONTH = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

// ─── Front-month logic ──────────────────────────────────────────────────────

/**
 * Given a date, a commodity's contract_months string, and its futures prefix,
 * return the front-month contract code in canonical format (e.g. "ZCK26").
 *
 * Assumes contracts expire on the 14th of their named month.
 * Front month = the nearest non-expired contract.
 */
function getFrontMonth(date, contractMonths, prefix) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const letters = contractMonths.split("");

  // Build sorted list of upcoming contract expirations
  // Check current year and next year
  for (const yr of [year, year + 1]) {
    for (const letter of letters) {
      const contractMonth = LETTER_TO_MONTH[letter];
      const expiryDay = 14;

      // Contract is still "front" if we're before its expiry
      if (yr > year || contractMonth > month || (contractMonth === month && day <= expiryDay)) {
        const yrStr = String(yr).slice(-2);
        return `${prefix}${letter}${yrStr}`;
      }
    }
  }

  // Fallback: first contract of next year
  const firstLetter = letters[0];
  return `${prefix}${firstLetter}${String(year + 1).slice(-2)}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1]) : 365;

  console.log(`\n📊 Commodity Price Pull`);
  console.log(`   Days: ${days} | Dry run: ${dryRun}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://hedgelab:hedgelab@localhost:5432/hedgelab_v2",
  });

  // Build date list (weekdays only, going back from yesterday)
  const dates = [];
  const today = new Date();
  for (let i = 1; dates.length < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (isWeekday(d)) dates.push(d);
  }
  dates.reverse(); // oldest first

  const apiSymbols = Object.values(COMMODITY_MAP).map((c) => c.apiSymbol).join(",");
  const reverseMap = {};
  for (const [commodityId, cfg] of Object.entries(COMMODITY_MAP)) {
    reverseMap[cfg.apiSymbol] = { commodityId, contractMonths: cfg.contractMonths, prefix: cfg.prefix };
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let apiCalls = 0;

  for (const date of dates) {
    const dateStr = formatDate(date);

    try {
      const url = `${API_BASE}/historical?apiKey=${API_KEY}&symbols=${apiSymbols}&date=${dateStr}`;
      const res = await fetch(url);
      apiCalls++;

      if (!res.ok) {
        console.log(`   ⚠ ${dateStr}: HTTP ${res.status}`);
        errors++;
        await sleep(500);
        continue;
      }

      const data = await res.json();
      if (!data.success || !data.rates) {
        console.log(`   ⚠ ${dateStr}: no data`);
        errors++;
        await sleep(500);
        continue;
      }

      for (const [apiSymbol, priceData] of Object.entries(data.rates)) {
        const info = reverseMap[apiSymbol];
        if (!info) continue;

        const contractMonth = getFrontMonth(date, info.contractMonths, info.prefix);

        if (dryRun) {
          console.log(`   [DRY] ${dateStr} | ${info.commodityId} | ${contractMonth} | close=${priceData.close}`);
          continue;
        }

        try {
          await pool.query(
            `INSERT INTO md_prices
               (org_id, commodity_id, contract_month, price_date, price_type,
                price, open_price, high_price, low_price, source)
             VALUES ($1, $2, $3, $4, 'settlement', $5, $6, $7, $8, 'commodity-price-api')
             ON CONFLICT (org_id, commodity_id, contract_month, price_date, price_type)
             DO UPDATE SET price = EXCLUDED.price,
                           open_price = EXCLUDED.open_price,
                           high_price = EXCLUDED.high_price,
                           low_price = EXCLUDED.low_price`,
            [
              ORG_ID,
              info.commodityId,
              contractMonth,
              dateStr,
              priceData.close,
              priceData.open ?? null,
              priceData.high ?? null,
              priceData.low ?? null,
            ]
          );
          inserted++;
        } catch (err) {
          console.log(`   ✗ ${dateStr} ${info.commodityId}: ${err.message}`);
          errors++;
        }
      }

      // Progress every 20 days
      if (apiCalls % 20 === 0) {
        console.log(`   ✓ ${dateStr} | ${apiCalls} calls | ${inserted} rows`);
      }
    } catch (err) {
      console.log(`   ✗ ${dateStr} fetch error: ${err.message}`);
      errors++;
    }

    // ~200ms delay to be respectful to API
    await sleep(200);
  }

  console.log(`\n✅ Done!`);
  console.log(`   API calls: ${apiCalls}`);
  console.log(`   Inserted/updated: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
