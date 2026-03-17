import { NextResponse } from "next/server";
import { listHedgeBooks, createHedgeBook } from "@/lib/hedgeBookService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    await requirePlugin(orgId, "position_manager");
    const books = await listHedgeBooks(orgId);
    return NextResponse.json(books);
  } catch (err) {
    if (err instanceof PluginNotEnabledError)
      return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[books] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, name, currency, orgUnitId, commodityId, displayOrder } = body;
    if (!orgId || !name) return NextResponse.json({ error: "Missing orgId or name" }, { status: 400 });

    await requirePlugin(orgId, "position_manager");
    const book = await createHedgeBook({ orgId, name, currency, orgUnitId, commodityId, displayOrder });
    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError)
      return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[books] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
