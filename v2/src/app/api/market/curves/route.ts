import { NextResponse } from "next/server";
import { getForwardCurve } from "@/lib/marketDataService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");
    const curveDate = searchParams.get("curveDate");

    if (!commodityId || !curveDate) {
      return NextResponse.json(
        { error: "Missing required parameters: commodityId, curveDate" },
        { status: 400 }
      );
    }

    const curve = await getForwardCurve(commodityId, curveDate);
    return NextResponse.json(curve);
  } catch (err) {
    console.error("[market/curves] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
