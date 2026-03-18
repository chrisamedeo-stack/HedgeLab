import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { getTrade, updateTrade, deleteTrade } from "@/lib/pmTradeService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getApiUser();
    const { id } = await params;

    const trade = await getTrade(id);
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    await requirePlugin(trade.org_id, "position_manager");
    return NextResponse.json(trade);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades/id] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getApiUser();
    const { id } = await params;
    const body = await request.json();

    const orgId = body.orgId || user.orgId;
    await requirePlugin(orgId, "position_manager");

    const updated = await updateTrade({
      orgId,
      userId: user.id,
      tradeId: id,
      siteId: body.siteId,
      budgetMonth: body.budgetMonth,
      portfolioId: body.portfolioId,
      marketPrice: body.marketPrice,
      basis: body.basis,
      flatPrice: body.flatPrice,
      isPriced: body.isPriced,
      deliveryLocationId: body.deliveryLocationId,
      logisticsAssigned: body.logisticsAssigned,
      efpId: body.efpId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades/id] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getApiUser();
    const { id } = await params;

    const trade = await getTrade(id);
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    await requirePlugin(trade.org_id, "position_manager");
    await deleteTrade(id, trade.org_id, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades/id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
