import { NextResponse } from "next/server";
import { getCounterparty, updateCounterparty, deleteCounterparty } from "@/lib/contractService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cp = await getCounterparty(id);
    if (!cp) return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
    return NextResponse.json(cp);
  } catch (err) {
    console.error("[counterparties/:id] GET error:", err);
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

    const cp = await updateCounterparty(id, userId, changes);
    return NextResponse.json(cp);
  } catch (err) {
    console.error("[counterparties/:id] PATCH error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
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
      return NextResponse.json({ error: "Missing required parameter: userId" }, { status: 400 });
    }

    await deleteCounterparty(id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[counterparties/:id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
