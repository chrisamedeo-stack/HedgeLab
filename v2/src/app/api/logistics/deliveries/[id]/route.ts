import { NextResponse } from "next/server";
import { getDelivery, updateDelivery, cancelDelivery } from "@/lib/logisticsService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await getDelivery(id);
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }
    return NextResponse.json(delivery);
  } catch (err) {
    console.error("[delivery] GET error:", err);
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
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const updated = await updateDelivery(id, userId, {
      status: changes.status,
      carrier: changes.carrier,
      vehicleId: changes.vehicleId,
      origin: changes.origin,
      destination: changes.destination,
      freightCost: changes.freightCost != null ? Number(changes.freightCost) : undefined,
      qualityResults: changes.qualityResults,
      weightTicket: changes.weightTicket,
      notes: changes.notes,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[delivery] PATCH error:", err);
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const cancelled = await cancelDelivery(id, userId);
    return NextResponse.json(cancelled);
  } catch (err) {
    console.error("[delivery] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
