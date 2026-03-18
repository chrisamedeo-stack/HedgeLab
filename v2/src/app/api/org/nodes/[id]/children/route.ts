import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll } from "@/lib/db";
import type { OrgNode } from "@/types/pm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getApiUser();
    const { id } = await params;

    const children = await queryAll<OrgNode>(
      `SELECT id, org_id, parent_id, tier_level, name, code, is_active, created_at
       FROM org_nodes
       WHERE parent_id = $1 AND is_active = true
       ORDER BY name`,
      [id]
    );

    return NextResponse.json(children);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/nodes/children] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
