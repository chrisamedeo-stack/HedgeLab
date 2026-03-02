import { NextResponse } from "next/server";
import { getLatestPrice, getLatestPrices } from "@/lib/marketDataService";

export async function GET(request: Request) {
  try {
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
      const price = await getLatestPrice(commodityId, contractMonth);
      return NextResponse.json(price);
    }

    // Otherwise return latest prices for all months
    const prices = await getLatestPrices(commodityId);
    return NextResponse.json(prices);
  } catch (err) {
    console.error("[market/prices/latest] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
