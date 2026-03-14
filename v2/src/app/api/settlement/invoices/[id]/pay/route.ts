import { NextResponse } from "next/server";
import { recordPayment } from "@/lib/settlementService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, paymentDate, paymentRef } = body;

    if (!userId || !paymentDate) {
      return NextResponse.json(
        { error: "Missing required fields: userId, paymentDate" },
        { status: 400 }
      );
    }

    const invoice = await recordPayment(id, userId, paymentDate, paymentRef);
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[invoice/pay] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
