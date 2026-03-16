import { NextResponse } from "next/server";
import { queryOne, queryAll } from "@/lib/db";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");

    if (!commodityId) {
      return NextResponse.json({ error: "Missing commodityId" }, { status: 400 });
    }

    // Count open trades for this commodity
    const openPositions = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM tc_financial_trades
       WHERE org_id = $1 AND commodity_id = $2 AND status != 'cancelled'
         AND remaining_volume > 0`,
      [user.orgId, commodityId]
    );

    // Get distinct contract months with open positions
    const openMonths = await queryAll<{ contract_month: string }>(
      `SELECT DISTINCT contract_month
       FROM tc_financial_trades
       WHERE org_id = $1 AND commodity_id = $2 AND status != 'cancelled'
         AND remaining_volume > 0
       ORDER BY contract_month`,
      [user.orgId, commodityId]
    );

    // For each open month, check if there's a latest price
    const missingMonths: string[] = [];
    let withPrice = 0;

    for (const { contract_month } of openMonths) {
      const price = await queryOne<{ price: string }>(
        `SELECT price FROM md_prices
         WHERE org_id = $1 AND commodity_id = $2 AND contract_month = $3
           AND price_type = 'settlement'
         ORDER BY price_date DESC LIMIT 1`,
        [user.orgId, commodityId, contract_month]
      );
      if (price) {
        withPrice++;
      } else {
        missingMonths.push(contract_month);
      }
    }

    return NextResponse.json({
      openPositions: Number(openPositions?.count ?? 0),
      withPrice,
      missingPrice: missingMonths.length,
      missingMonths,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices/mtm-coverage] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
