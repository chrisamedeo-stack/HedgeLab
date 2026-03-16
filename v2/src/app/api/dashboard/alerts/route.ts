import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { getDashboardAlerts } from "@/lib/dashboardService";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);

    const orgUnitId = searchParams.get("orgUnitId") ?? undefined;
    const siteId = searchParams.get("siteId") ?? undefined;
    const commodityId = searchParams.get("commodityId") ?? undefined;

    const alerts = await getDashboardAlerts(user.orgId, commodityId, orgUnitId, siteId);
    return NextResponse.json(alerts);
  } catch (err) {
    console.error("[dashboard/alerts] GET error:", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
