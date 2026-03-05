import { NextResponse } from "next/server";
import { getLimit, updateLimit, deleteLimit } from "@/lib/riskService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const limit = await getLimit(id);
    if (!limit) return NextResponse.json({ error: "Limit not found" }, { status: 404 });
    return NextResponse.json(limit);
  } catch (err) {
    console.error("[risk/limits/:id] GET error:", err);
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

    const limit = await updateLimit(id, userId, changes);
    return NextResponse.json(limit);
  } catch (err) {
    console.error("[risk/limits/:id] PATCH error:", err);
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

    await deleteLimit(id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[risk/limits/:id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
