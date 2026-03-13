import { NextResponse } from "next/server";
import { getForwardCurve } from "@/lib/marketDataService";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");
    const curveDate = searchParams.get("curveDate");

    if (!commodityId || !curveDate) {
      return NextResponse.json(
        { error: "Missing required parameters: commodityId, curveDate" },
        { status: 400 }
      );
    }

    const curve = await getForwardCurve(user.orgId, commodityId, curveDate);
    return NextResponse.json(curve);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/curves] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
