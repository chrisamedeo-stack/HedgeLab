import { NextResponse } from "next/server";
import { getVersionHistory, createVersionSnapshot } from "@/lib/budgetService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const versions = await getVersionHistory(periodId);
    return NextResponse.json(versions);
  } catch (err) {
    console.error("[budget/versions] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const body = await request.json();
    const { userId, name } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const version = await createVersionSnapshot(periodId, userId, name);
    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    console.error("[budget/versions] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
