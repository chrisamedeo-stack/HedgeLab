import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll, query } from "@/lib/db";
import type { OrgFeature } from "@/types/pm";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || user.orgId;

    const rows = await queryAll<OrgFeature>(
      `SELECT id, org_id, flag_name, enabled FROM org_features WHERE org_id = $1 ORDER BY flag_name`,
      [orgId]
    );

    // Return as a map for easy lookup
    const flags: Record<string, boolean> = {};
    for (const row of rows) {
      flags[row.flag_name] = row.enabled;
    }

    return NextResponse.json({ flags, rows });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/features] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();
    const { orgId, flagName, enabled } = body;

    if (!orgId || !flagName || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: orgId, flagName, enabled" },
        { status: 400 }
      );
    }

    // Admin only
    if (user.roleId !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await query(
      `INSERT INTO org_features (org_id, flag_name, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, flag_name) DO UPDATE SET enabled = $3`,
      [orgId, flagName, enabled]
    );

    return NextResponse.json({ flagName, enabled });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/features] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
