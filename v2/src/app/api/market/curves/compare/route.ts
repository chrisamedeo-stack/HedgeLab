import { NextResponse } from "next/server";
import { getForwardCurveComparison } from "@/lib/marketDataService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") ?? user.orgId;
    const commodityId = searchParams.get("commodityId");

    if (!commodityId) {
      return NextResponse.json(
        { error: "Missing required parameter: commodityId" },
        { status: 400 }
      );
    }

    await requirePlugin(orgId, "market_data");

    const compareDate = searchParams.get("compareDate") ?? undefined;
    const result = await getForwardCurveComparison(orgId, commodityId, compareDate);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[market/curves/compare] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
