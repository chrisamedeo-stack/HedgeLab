import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commodityId = searchParams.get("commodityId");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    let sql = `
      SELECT id, commodity_id, contract_month,
             first_notice_date, last_trade_date, expiration_date,
             first_delivery_date, last_delivery_date,
             is_active, source, created_at,
             CASE WHEN first_notice_date IS NOT NULL
                  THEN first_notice_date - CURRENT_DATE END as days_to_first_notice,
             CASE WHEN last_trade_date IS NOT NULL
                  THEN last_trade_date - CURRENT_DATE END as days_to_last_trade,
             CASE WHEN expiration_date IS NOT NULL
                  THEN expiration_date < CURRENT_DATE END as is_expired
      FROM commodity_contract_calendar
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (commodityId) {
      params.push(commodityId);
      sql += ` AND commodity_id = $${params.length}`;
    }
    if (activeOnly) {
      sql += ` AND is_active = true`;
    }

    sql += ` ORDER BY commodity_id, contract_month`;

    const calendar = await queryAll(sql, params);
    return NextResponse.json(calendar);
  } catch (err) {
    console.error("[contract-calendar] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      commodityId, contractMonth,
      firstNoticeDate, lastTradeDate, expirationDate,
      firstDeliveryDate, lastDeliveryDate,
      source = "manual",
    } = body;

    if (!commodityId || !contractMonth) {
      return NextResponse.json(
        { error: "Missing required fields: commodityId, contractMonth" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO commodity_contract_calendar
         (commodity_id, contract_month, first_notice_date, last_trade_date,
          expiration_date, first_delivery_date, last_delivery_date, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (commodity_id, contract_month)
       DO UPDATE SET
         first_notice_date = EXCLUDED.first_notice_date,
         last_trade_date = EXCLUDED.last_trade_date,
         expiration_date = EXCLUDED.expiration_date,
         first_delivery_date = EXCLUDED.first_delivery_date,
         last_delivery_date = EXCLUDED.last_delivery_date,
         source = EXCLUDED.source
       RETURNING *`,
      [commodityId, contractMonth, firstNoticeDate ?? null, lastTradeDate ?? null,
       expirationDate ?? null, firstDeliveryDate ?? null, lastDeliveryDate ?? null, source]
    );

    await auditLog({
      module: "kernel",
      entityType: "contract_calendar",
      entityId: result.rows[0].id.toString(),
      action: "upsert",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[contract-calendar] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
