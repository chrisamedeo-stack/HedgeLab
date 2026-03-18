import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll } from "@/lib/db";
import type { OrgTierConfig } from "@/types/pm";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || user.orgId;

    const tiers = await queryAll<OrgTierConfig>(
      `SELECT id, org_id, tier_level, tier_name, tier_name_plural, is_leaf
       FROM org_tier_config
       WHERE org_id = $1
       ORDER BY tier_level`,
      [orgId]
    );

    return NextResponse.json(tiers);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/tiers] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
