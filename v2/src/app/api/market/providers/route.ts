import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { getApiUser, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getApiUser();
    const providers = await queryAll(
      `SELECT id, org_id, provider_type, name, is_primary, is_active, config,
              poll_interval_minutes, last_poll_at, last_poll_status
       FROM md_providers
       WHERE org_id = $1 AND is_active = true
       ORDER BY is_primary DESC, name`,
      [user.orgId]
    );
    return NextResponse.json(providers);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[market/providers] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
