import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string; counterpartyId: string }> }
) {
  try {
    const { siteId, counterpartyId } = await params;

    const site = await queryOne<{ org_id: string }>(`SELECT org_id FROM sites WHERE id = $1`, [siteId]);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Try to get userId from body (may be empty for DELETE)
    let userId: string | undefined;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // empty body is fine
    }

    await query(
      `DELETE FROM site_suppliers WHERE site_id = $1 AND counterparty_id = $2`,
      [siteId, counterpartyId]
    );

    await auditLog({
      orgId: site.org_id,
      userId,
      module: "kernel",
      entityType: "site_supplier",
      entityId: siteId,
      action: "unlink",
      before: { siteId, counterpartyId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[site-suppliers] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
