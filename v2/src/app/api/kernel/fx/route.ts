import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { convertCurrency } from "@/lib/fx";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // If conversion params provided, do a conversion
    const amount = searchParams.get("amount");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");

    if (amount && from && to) {
      const result = await convertCurrency(
        parseFloat(amount),
        from,
        to,
        date ?? undefined
      );
      return NextResponse.json(result);
    }

    // Otherwise list recent rates
    const rates = await queryAll(
      `SELECT id, from_currency, to_currency, rate_date, rate, source, created_at
       FROM fx_rates ORDER BY rate_date DESC, from_currency LIMIT 100`
    );
    return NextResponse.json(rates);
  } catch (err) {
    console.error("[fx] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromCurrency, toCurrency, rateDate, rate, source = "manual" } = body;

    if (!fromCurrency || !toCurrency || !rateDate || rate == null) {
      return NextResponse.json(
        { error: "Missing required fields: fromCurrency, toCurrency, rateDate, rate" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO fx_rates (from_currency, to_currency, rate_date, rate, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (from_currency, to_currency, rate_date)
       DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source
       RETURNING *`,
      [fromCurrency, toCurrency, rateDate, rate, source]
    );

    await auditLog({
      module: "kernel",
      entityType: "fx_rate",
      entityId: result.rows[0].id.toString(),
      action: "upsert",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[fx] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
