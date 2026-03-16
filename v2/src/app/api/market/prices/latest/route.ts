import { NextResponse } from "next/server";
import { getLatestPrice, getLatestPrices } from "@/lib/marketDataService";
import { queryOne } from "@/lib/db";
import { getApiUser, AuthError } from "@/lib/auth";

const MONTH_CODE_MAP: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

/** Generate YYYY-MM strings for expected contract months */
function generateExpectedMonths(contractMonths: string, years = 3): string[] {
  const codes = (contractMonths || "").split("").filter((ch) => /[A-Z]/.test(ch));
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const result: string[] = [];

  for (let y = currentYear; y < currentYear + years; y++) {
    for (const code of codes) {
      const m = MONTH_CODE_MAP[code];
      if (m == null) continue;
      if (y === currentYear && m < currentMonth) continue;
      result.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");
    const contractMonth = searchParams.get("contractMonth");
    const includeExpected = searchParams.get("includeExpected") === "true";

    if (!commodityId) {
      return NextResponse.json(
        { error: "Missing required parameter: commodityId" },
        { status: 400 }
      );
    }

    // If contractMonth provided, return single latest price
    if (contractMonth) {
      const price = await getLatestPrice(user.orgId, commodityId, contractMonth);
      return NextResponse.json(price);
    }

    // Otherwise return latest prices for all months
    const prices = await getLatestPrices(user.orgId, commodityId);

    // If includeExpected, also compute expected months and find missing ones
    if (includeExpected) {
      const commodity = await queryOne<{ contract_months: string | null }>(
        `SELECT contract_months FROM commodities WHERE id = $1`,
        [commodityId]
      );

      const expectedMonths = commodity?.contract_months
        ? generateExpectedMonths(commodity.contract_months, 3)
        : [];

      const pricedMonths = new Set(prices.map((p) => p.contract_month));
      const missingMonths = expectedMonths.filter((m) => !pricedMonths.has(m));

      return NextResponse.json({
        prices,
        expectedMonths,
        missingMonths,
      });
    }

    return NextResponse.json(prices);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices/latest] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
