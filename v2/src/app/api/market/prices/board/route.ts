import { NextResponse } from "next/server";
import { getPriceBoard } from "@/lib/marketDataService";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    await requirePlugin(user.orgId, "market_data");

    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId") ?? undefined;

    const rows = await getPriceBoard(user.orgId, commodityId);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[market/prices/board] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
