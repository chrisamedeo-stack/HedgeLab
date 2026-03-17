import { NextResponse } from "next/server";
import { getHedgeBook, updateHedgeBook, deactivateHedgeBook } from "@/lib/hedgeBookService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const book = await getHedgeBook(bookId);
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(book);
  } catch (err) {
    console.error("[books/:id] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const body = await request.json();
    const book = await updateHedgeBook(bookId, body);
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(book);
  } catch (err) {
    console.error("[books/:id] PATCH error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const result = await deactivateHedgeBook(bookId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[books/:id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
