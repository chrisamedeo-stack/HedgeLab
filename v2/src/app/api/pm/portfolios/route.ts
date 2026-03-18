import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { Portfolio } from "@/types/pm";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || user.orgId;

    const portfolios = await queryAll<Portfolio>(
      `SELECT id, org_id, name, description, commodity, is_active, created_at
       FROM portfolios
       WHERE org_id = $1 AND is_active = true
       ORDER BY name`,
      [orgId]
    );

    return NextResponse.json(portfolios);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[pm/portfolios] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();
    const { orgId, name, description, commodity } = body;

    if (!orgId || !name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, name" },
        { status: 400 }
      );
    }

    const result = await query<Portfolio>(
      `INSERT INTO portfolios (org_id, name, description, commodity)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orgId, name, description || null, commodity || null]
    );
    const portfolio = result.rows[0];

    await auditLog({
      orgId,
      userId: user.id,
      module: "position_manager",
      entityType: "portfolio",
      entityId: portfolio.id,
      action: "create",
      after: portfolio as unknown as Record<string, unknown>,
    });

    return NextResponse.json(portfolio, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[pm/portfolios] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
