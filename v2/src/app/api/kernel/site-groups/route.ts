import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const groupType = searchParams.get("type");

    let sql = `
      SELECT sg.id, sg.org_id, sg.name, sg.group_type, sg.parent_id, sg.sort_order,
             COALESCE(
               json_agg(
                 json_build_object('id', s.id, 'name', s.name, 'code', s.code, 'region', s.region)
               ) FILTER (WHERE s.id IS NOT NULL),
               '[]'
             ) as sites
      FROM site_groups sg
      LEFT JOIN site_group_members sgm ON sgm.site_group_id = sg.id
      LEFT JOIN sites s ON s.id = sgm.site_id AND s.is_active = true
      WHERE sg.is_active = true
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND sg.org_id = $${params.length}`;
    }
    if (groupType) {
      params.push(groupType);
      sql += ` AND sg.group_type = $${params.length}`;
    }

    sql += ` GROUP BY sg.id ORDER BY sg.sort_order, sg.name`;

    const groups = await queryAll(sql, params);
    return NextResponse.json(groups);
  } catch (err) {
    console.error("[site-groups] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
