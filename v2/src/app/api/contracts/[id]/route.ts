import { NextResponse } from "next/server";
import {
  getContract,
  updateContract,
  cancelContract,
  activateContract,
  completeContract,
  recordDelivery,
} from "@/lib/contractService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contract = await getContract(id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    return NextResponse.json(contract);
  } catch (err) {
    console.error("[contracts/:id] GET error:", err);
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
    const { userId, action, ...changes } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });
    }

    // Handle status transitions
    if (action === "activate") {
      const contract = await activateContract(id, userId);
      return NextResponse.json(contract);
    }
    if (action === "complete") {
      const contract = await completeContract(id, userId);
      return NextResponse.json(contract);
    }
    if (action === "deliver") {
      if (!changes.volume) {
        return NextResponse.json({ error: "Missing volume for delivery" }, { status: 400 });
      }
      const contract = await recordDelivery(id, userId, Number(changes.volume));
      return NextResponse.json(contract);
    }

    const contract = await updateContract(id, userId, changes);
    return NextResponse.json(contract);
  } catch (err) {
    console.error("[contracts/:id] PATCH error:", err);
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
    const reason = searchParams.get("reason") ?? undefined;

    if (!userId) {
      return NextResponse.json({ error: "Missing required parameter: userId" }, { status: 400 });
    }

    const contract = await cancelContract(id, userId, reason);
    return NextResponse.json(contract);
  } catch (err) {
    console.error("[contracts/:id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
