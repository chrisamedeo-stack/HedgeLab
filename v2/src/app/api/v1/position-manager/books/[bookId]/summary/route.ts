import { NextResponse } from "next/server";
import { getBookSummary } from "@/lib/hedgeBookService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const summary = await getBookSummary(bookId);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[books/:id/summary] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
