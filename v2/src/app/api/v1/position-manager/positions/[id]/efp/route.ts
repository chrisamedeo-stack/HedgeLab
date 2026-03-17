import { NextResponse } from "next/server";
import { executeEFP } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, physicalContractId, efpBasis, efpDate, efpMarketPrice, volume } = body;

    if (!userId || !physicalContractId || efpBasis == null || !efpDate || efpMarketPrice == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await executeEFP({
      tradeId: id, userId, physicalContractId, efpBasis, efpDate, efpMarketPrice, volume,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/efp] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
