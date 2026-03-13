import { NextResponse } from "next/server";
import { getLatestPrice, getLatestPrices } from "@/lib/marketDataService";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");
    const contractMonth = searchParams.get("contractMonth");

    if (!commodityId) {
      return NextResponse.json(
        { error: "Missing required parameter: commodityId" },
        { status: 400 }
      );
    }

    // If contractMonth provided, return single latest price
    if (contractMonth) {
      const price = await getLatestPrice(user.orgId, commodityId, contractMonth);
      return NextResponse.json(price);
    }

    // Otherwise return latest prices for all months
    const prices = await getLatestPrices(user.orgId, commodityId);
    return NextResponse.json(prices);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices/latest] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
