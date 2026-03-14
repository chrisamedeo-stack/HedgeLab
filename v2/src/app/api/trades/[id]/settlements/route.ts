import { NextResponse } from "next/server";
import { getSwapSettlements, generateSwapSettlements, settleSwapPeriod } from "@/lib/tradeService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auto-generate settlements if none exist
    let settlements = await getSwapSettlements(id);
    if (settlements.length === 0) {
      try {
        settlements = await generateSwapSettlements(id);
      } catch {
        // Not a swap or no details — return empty
      }
    }

    return NextResponse.json(settlements);
  } catch (err) {
    console.error("[settlements] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Settle a specific period
    if (body.settlementId && body.floatingPrice != null && body.userId) {
      const result = await settleSwapPeriod(body.settlementId, body.userId, Number(body.floatingPrice));
      return NextResponse.json(result);
    }

    // Generate settlements
    const settlements = await generateSwapSettlements(id);
    return NextResponse.json(settlements, { status: 201 });
  } catch (err) {
    console.error("[settlements] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
