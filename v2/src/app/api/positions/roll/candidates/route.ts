import { NextResponse } from "next/server";
import { getRolloverCandidates } from "@/lib/positionService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const commodityId = searchParams.get("commodityId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const candidates = await getRolloverCandidates(orgId, commodityId ?? undefined);

    // Group by urgency
    const grouped = {
      CRITICAL: candidates.filter((c) => c.urgency === "CRITICAL"),
      URGENT: candidates.filter((c) => c.urgency === "URGENT"),
      UPCOMING: candidates.filter((c) => c.urgency === "UPCOMING"),
    };

    return NextResponse.json({ candidates, grouped });
  } catch (err) {
    console.error("[roll/candidates] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
