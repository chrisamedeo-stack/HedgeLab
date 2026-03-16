import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { getSiteOperationalData } from "@/lib/dashboardService";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get("siteId");
    if (!siteId) {
      return NextResponse.json({ error: "siteId required" }, { status: 400 });
    }

    const commodityId = searchParams.get("commodityId") ?? undefined;
    const data = await getSiteOperationalData(user.orgId, siteId, commodityId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[dashboard/site-operational] GET error:", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
