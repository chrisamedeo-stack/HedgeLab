import { NextResponse } from "next/server";
import { listPrices, createPrice } from "@/lib/marketDataService";
import type { CreatePriceParams } from "@/lib/marketDataService";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);

    const prices = await listPrices({
      orgId: user.orgId,
      commodityId: searchParams.get("commodityId") ?? undefined,
      contractMonth: searchParams.get("contractMonth") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      priceType: searchParams.get("priceType") ?? undefined,
    });

    return NextResponse.json(prices);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();

    // Support single or bulk (array)
    const items: CreatePriceParams[] = Array.isArray(body) ? body : [body];

    // Validate required fields
    for (const item of items) {
      if (!item.commodityId || !item.contractMonth ||
          !item.priceDate || item.price === undefined) {
        return NextResponse.json(
          { error: "Missing required fields: commodityId, contractMonth, priceDate, price" },
          { status: 400 }
        );
      }
      // Inject userId from auth
      item.userId = user.id;
    }

    // Create each price and collect the returned rows (backward-compatible)
    const results = [];
    for (const item of items) {
      const row = await createPrice(user.orgId, item);
      results.push(row);
    }

    return NextResponse.json(Array.isArray(body) ? results : results[0], { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/prices] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
