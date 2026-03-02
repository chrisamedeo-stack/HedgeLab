import { NextResponse } from "next/server";
import { getSitePosition } from "@/lib/positionService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");

    const siteView = await getSitePosition(siteId, commodityId ?? undefined);
    return NextResponse.json(siteView);
  } catch (err) {
    console.error("[site-view] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
