import { NextResponse } from "next/server";
import { listPrices, createPrice, createPrices } from "@/lib/marketDataService";
import type { CreatePriceParams } from "@/lib/marketDataService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const prices = await listPrices({
      commodityId: searchParams.get("commodityId") ?? undefined,
      contractMonth: searchParams.get("contractMonth") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      priceType: searchParams.get("priceType") ?? undefined,
    });

    return NextResponse.json(prices);
  } catch (err) {
    console.error("[market/prices] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support single or bulk (array)
    const items: CreatePriceParams[] = Array.isArray(body) ? body : [body];

    // Validate required fields
    for (const item of items) {
      if (!item.userId || !item.commodityId || !item.contractMonth ||
          !item.priceDate || item.price === undefined) {
        return NextResponse.json(
          { error: "Missing required fields: userId, commodityId, contractMonth, priceDate, price" },
          { status: 400 }
        );
      }
    }

    const results = await createPrices(items);

    return NextResponse.json(Array.isArray(body) ? results : results[0], { status: 201 });
  } catch (err) {
    console.error("[market/prices] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
