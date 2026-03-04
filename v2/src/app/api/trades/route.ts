import { NextResponse } from "next/server";
import { createTrade, listTrades } from "@/lib/tradeService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import type { CreateTradeParams, TradeFilters } from "@/types/trades";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing required parameter: orgId" }, { status: 400 });
    }

    await requirePlugin(orgId, "trade_capture");

    const filters: TradeFilters = {
      orgId,
      commodityId: searchParams.get("commodityId") ?? undefined,
      status: (searchParams.get("status") as TradeFilters["status"]) ?? undefined,
      contractMonth: searchParams.get("contractMonth") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    };

    const trades = await listTrades(filters);
    return NextResponse.json(trades);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[trades] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support bulk creation (array of trades)
    const items: CreateTradeParams[] = Array.isArray(body) ? body : [body];

    // Plugin gate — use orgId from first item
    if (items[0]?.orgId) await requirePlugin(items[0].orgId, "trade_capture");

    // Validate each item
    for (const item of items) {
      if (!item.orgId || !item.userId || !item.commodityId || !item.direction ||
          !item.tradeDate || !item.contractMonth || !item.numContracts ||
          !item.contractSize || item.tradePrice === undefined) {
        return NextResponse.json(
          { error: "Missing required fields: orgId, userId, commodityId, direction, tradeDate, contractMonth, numContracts, contractSize, tradePrice" },
          { status: 400 }
        );
      }
    }

    const results = [];
    for (const item of items) {
      const trade = await createTrade({
        orgId: item.orgId,
        userId: item.userId,
        commodityId: item.commodityId,
        tradeType: item.tradeType,
        direction: item.direction,
        tradeDate: item.tradeDate,
        contractMonth: item.contractMonth,
        broker: item.broker,
        accountNumber: item.accountNumber,
        numContracts: Number(item.numContracts),
        contractSize: Number(item.contractSize),
        tradePrice: Number(item.tradePrice),
        currency: item.currency,
        commission: item.commission ? Number(item.commission) : undefined,
        fees: item.fees ? Number(item.fees) : undefined,
        optionType: item.optionType,
        strikePrice: item.strikePrice ? Number(item.strikePrice) : undefined,
        premium: item.premium ? Number(item.premium) : undefined,
        expirationDate: item.expirationDate,
        externalRef: item.externalRef,
        notes: item.notes,
        importJobId: item.importJobId,
      });
      results.push(trade);
    }

    // Return single trade or array depending on input
    return NextResponse.json(Array.isArray(body) ? results : results[0], { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[trades] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
