import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { cancelAllocation, getAllocation, getPositionChain } from "@/lib/positionService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allocation = await getAllocation(id);
    if (!allocation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Include chain info
    const chain = await getPositionChain(id);

    return NextResponse.json({ ...allocation, chain });
  } catch (err) {
    console.error("[allocation/:id] GET error:", err);
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
    const { userId, budgetMonth, notes, siteId } = body;

    const before = await getAllocation(id);
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (before.status !== "open") {
      return NextResponse.json(
        { error: `Cannot update — status is ${before.status}` },
        { status: 400 }
      );
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (budgetMonth !== undefined) { sets.push(`budget_month = $${idx++}`); vals.push(budgetMonth); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(notes); }
    if (siteId !== undefined) { sets.push(`site_id = $${idx++}`); vals.push(siteId); }

    if (sets.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    vals.push(id);
    const result = await query(
      `UPDATE pm_allocations SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );

    const after = result.rows[0];

    await auditLog({
      orgId: before.org_id ?? undefined,
      userId,
      module: "positions",
      entityType: "allocation",
      entityId: id,
      action: "update",
      before: before as unknown as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });

    return NextResponse.json(after);
  } catch (err) {
    console.error("[allocation/:id] PATCH error:", err);
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
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const result = await cancelAllocation({
      userId,
      allocationId: id,
      notes: "Cancelled via API",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[allocation/:id] DELETE error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
