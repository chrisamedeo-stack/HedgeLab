import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { getUserPermissions } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // If userId provided, return that user's effective permissions
    if (userId) {
      const perms = await getUserPermissions(userId);
      return NextResponse.json({ userId, permissions: perms });
    }

    // Otherwise return all roles with their permissions
    const roles = await queryAll(
      `SELECT r.id, r.name, r.description, r.is_system,
              COALESCE(
                json_agg(rp.permission_id ORDER BY rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL),
                '[]'
              ) as permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       GROUP BY r.id
       ORDER BY r.name`
    );
    return NextResponse.json(roles);
  } catch (err) {
    console.error("[permissions] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
