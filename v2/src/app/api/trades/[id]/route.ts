import { NextResponse } from "next/server";
import { getTradeWithAllocations, updateTrade, cancelTrade, deleteTrade } from "@/lib/tradeService";
import { getApiUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getTradeWithAllocations(id);
    if (!result) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[trades/:id] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, ...changes } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });
    }

    const trade = await updateTrade(id, userId, changes);
    return NextResponse.json(trade);
  } catch (err) {
    console.error("[trades/:id] PATCH error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");
    const reason = searchParams.get("reason") ?? undefined;

    // Fall back to authenticated user from cookie if userId not in query
    if (!userId) {
      try {
        const authUser = await getApiUser();
        userId = authUser.id;
      } catch {
        return NextResponse.json({ error: "Missing required parameter: userId" }, { status: 400 });
      }
    }

    const action = searchParams.get("action");

    if (action === "delete") {
      await deleteTrade(id, userId);
      return NextResponse.json({ success: true });
    }

    const trade = await cancelTrade(id, userId, reason);
    return NextResponse.json(trade);
  } catch (err) {
    console.error("[trades/:id] DELETE error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
