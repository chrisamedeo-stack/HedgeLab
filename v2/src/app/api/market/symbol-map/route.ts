import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { getApiUser, AuthError } from "@/lib/auth";
import { upsertSymbolMapping } from "@/lib/marketData/symbolMap";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");

    let sql = `
      SELECT sm.*, p.name AS provider_name, p.provider_type
      FROM md_symbol_map sm
      JOIN md_providers p ON p.id = sm.provider_id
      WHERE sm.org_id = $1
    `;
    const params: unknown[] = [user.orgId];

    if (commodityId) {
      params.push(commodityId);
      sql += ` AND sm.commodity_id = $${params.length}`;
    }

    sql += ` ORDER BY sm.commodity_id, p.name`;

    const rows = await queryAll(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/symbol-map] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();
    const { providerId, commodityId, providerSymbol, providerRoot } = body;

    if (!providerId || !commodityId || !providerSymbol) {
      return NextResponse.json(
        { error: "Missing required fields: providerId, commodityId, providerSymbol" },
        { status: 400 }
      );
    }

    await upsertSymbolMapping(user.orgId, providerId, {
      commodityId,
      providerSymbol,
      providerRoot: providerRoot ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/symbol-map] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
