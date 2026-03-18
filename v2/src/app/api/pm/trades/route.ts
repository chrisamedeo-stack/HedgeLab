import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { listTrades, createTrade } from "@/lib/pmTradeService";
import type { PmTradeFilters, TradeCategory, TradeInstrument, TradeDirection } from "@/types/pm";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || user.orgId;

    await requirePlugin(orgId, "position_manager");

    const filters: PmTradeFilters = {
      category: (searchParams.get("category") as TradeCategory) || undefined,
      orgNodeId: searchParams.get("org_node_id") || undefined,
      portfolioId: searchParams.get("portfolio_id") || undefined,
      commodity: searchParams.get("commodity") || undefined,
      instrument: (searchParams.get("instrument") as TradeInstrument) || undefined,
      direction: (searchParams.get("direction") as TradeDirection) || undefined,
      deliveryLocationId: searchParams.get("delivery_location_id") || undefined,
      budgetMonth: searchParams.get("budget_month") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
      pageSize: searchParams.get("page_size") ? parseInt(searchParams.get("page_size")!, 10) : undefined,
    };

    if (searchParams.has("is_priced")) {
      filters.isPriced = searchParams.get("is_priced") === "true";
    }

    const result = await listTrades(orgId, filters);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();

    const orgId = body.orgId || user.orgId;
    await requirePlugin(orgId, "position_manager");

    if (!body.tradeDate || !body.category || !body.commodity || !body.instrument || !body.direction || !body.quantity) {
      return NextResponse.json(
        { error: "Missing required fields: tradeDate, category, commodity, instrument, direction, quantity" },
        { status: 400 }
      );
    }

    const trade = await createTrade({
      orgId,
      userId: user.id,
      tradeDate: body.tradeDate,
      category: body.category,
      commodity: body.commodity,
      instrument: body.instrument,
      direction: body.direction,
      quantity: body.quantity,
      portfolioId: body.portfolioId,
      siteId: body.siteId,
      budgetMonth: body.budgetMonth,
      contracts: body.contracts,
      contractMonth: body.contractMonth,
      tradePrice: body.tradePrice,
      strike: body.strike,
      putCall: body.putCall,
      premium: body.premium,
      delta: body.delta,
      basis: body.basis,
      boardMonth: body.boardMonth,
      flatPrice: body.flatPrice,
      isPriced: body.isPriced,
      deliveryLocationId: body.deliveryLocationId,
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
