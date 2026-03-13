import { NextResponse } from "next/server";
import { uploadPrices, commitUpload } from "@/lib/marketDataService";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

/** POST: Parse uploaded file and return preview */
export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    await requirePlugin(user.orgId, "market_data");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { parsed, errors } = await uploadPrices(
      user.orgId,
      user.id,
      buffer,
      file.name
    );

    // Build preview rows with validation status
    const errorRowSet = new Set(errors.map((e) => e.row));
    const errorMap = new Map<number, string>();
    for (const e of errors) {
      const prev = errorMap.get(e.row) ?? "";
      errorMap.set(e.row, prev ? `${prev}; ${e.field}: ${e.message}` : `${e.field}: ${e.message}`);
    }

    const rows = parsed.map((r, i) => ({
      row: i,
      commodityId: r.commodityId,
      contractMonth: r.contractMonth,
      priceDate: r.priceDate,
      settle: r.settle,
      status: errorRowSet.has(i) ? ("error" as const) : ("valid" as const),
      error: errorMap.get(i),
    }));

    return NextResponse.json({
      filename: file.name,
      totalRows: parsed.length,
      validRows: parsed.length - errorRowSet.size,
      errorRows: errorRowSet.size,
      rows,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[market/upload] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** PUT: Commit validated rows */
export async function PUT(request: Request) {
  try {
    const user = await getApiUser();
    await requirePlugin(user.orgId, "market_data");

    const body = await request.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array" }, { status: 400 });
    }

    // Map UploadPreviewRow back to ParsedRow
    const parsedRows = rows
      .filter((r: { status: string }) => r.status === "valid")
      .map((r: { commodityId: string; contractMonth: string; priceDate: string; settle: number }) => ({
        commodityId: r.commodityId,
        contractMonth: r.contractMonth,
        priceDate: r.priceDate,
        settle: r.settle,
      }));

    const result = await commitUpload(user.orgId, user.id, parsedRows);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[market/upload] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
