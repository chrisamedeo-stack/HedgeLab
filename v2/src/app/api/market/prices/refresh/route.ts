import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { refreshFromExternalApi } from "@/lib/marketDataService";

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    await requirePlugin(user.orgId, "market_data");
    await requirePermission(user.id, "market.enter_price");

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

    const result = await refreshFromExternalApi(user.orgId, days);
    return NextResponse.json({ ...result, days });
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
