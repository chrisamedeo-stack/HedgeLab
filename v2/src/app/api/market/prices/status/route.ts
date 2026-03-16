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

    // Get provider info from symbol map
    const providerInfo = await queryOne<{ provider_name: string; provider_id: string }>(
      `SELECT p.name AS provider_name, p.id AS provider_id
       FROM md_symbol_map sm
       JOIN md_providers p ON p.id = sm.provider_id
       WHERE sm.org_id = $1 AND sm.commodity_id = $2 AND sm.is_active = true
       LIMIT 1`,
      [user.orgId, commodityId]
    );

    // Get last update time
    const lastUpdate = await queryOne<{ last_date: string }>(
      `SELECT MAX(price_date)::text AS last_date
       FROM md_prices
       WHERE org_id = $1 AND commodity_id = $2`,
      [user.orgId, commodityId]
    );

    // Get commodity's contract months
    const commodity = await queryOne<{ contract_months: string | null }>(
      `SELECT contract_months FROM commodities WHERE id = $1`,
      [commodityId]
    );

    // Count distinct contract months with prices (active months only — current year forward)
    const currentYear = new Date().getFullYear();
    const cutoff = `${currentYear}-01`;
    const pricedMonths = await queryAll<{ contract_month: string }>(
      `SELECT DISTINCT contract_month
       FROM md_prices
       WHERE org_id = $1 AND commodity_id = $2 AND contract_month >= $3`,
      [user.orgId, commodityId, cutoff]
    );

    // Calculate total expected active months from contract_months config
    const letters = (commodity?.contract_months ?? "").split("").filter((ch) => /[A-Z]/.test(ch));
    // Approximate: contract trades ~2 years of months
    const totalContracts = letters.length > 0 ? letters.length * 2 : 0;
    const contractsPriced = pricedMonths.length;

    // History depth
    const historyStats = await queryOne<{ history_days: string; earliest_date: string }>(
      `SELECT COUNT(DISTINCT price_date)::text AS history_days,
              MIN(price_date)::text AS earliest_date
       FROM md_prices
       WHERE org_id = $1 AND commodity_id = $2`,
      [user.orgId, commodityId]
    );

    return NextResponse.json({
      provider: providerInfo?.provider_name ?? null,
      providerId: providerInfo?.provider_id ?? null,
      lastUpdate: lastUpdate?.last_date ?? null,
      contractsPriced,
      totalContracts,
      historyDays: Number(historyStats?.history_days ?? 0),
      earliestDate: historyStats?.earliest_date ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices/status] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
