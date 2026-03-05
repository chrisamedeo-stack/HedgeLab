import { NextResponse } from "next/server";
import { getCoverageBySite, getPositionsByMonth } from "@/lib/dashboardService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const commodityId = searchParams.get("commodityId") ?? undefined;

    const [coverageBySite, positionsByMonth] = await Promise.all([
      getCoverageBySite(orgId, commodityId),
      getPositionsByMonth(orgId, commodityId),
    ]);

    return NextResponse.json({ coverageBySite, positionsByMonth });
  } catch (err) {
    console.error("[dashboard/data] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
