import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const region = searchParams.get("region");

    let sql = `
      SELECT s.id, s.org_id, s.site_type_id, s.name, s.code, s.region,
             s.timezone, s.is_active, s.config,
             st.name as site_type_name, st.operating_model, st.features,
             st.supported_commodities, st.position_sections
      FROM sites s
      JOIN site_types st ON st.id = s.site_type_id
      WHERE s.is_active = true
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND s.org_id = $${params.length}`;
    }
    if (region) {
      params.push(region);
      sql += ` AND s.region = $${params.length}`;
    }

    sql += ` ORDER BY s.region, s.name`;

    const sites = await queryAll(sql, params);
    return NextResponse.json(sites);
  } catch (err) {
    console.error("[sites] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
