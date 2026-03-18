import { NextResponse } from "next/server";
import { getBookPositions } from "@/lib/hedgeBookService";
import type { PipelineTab } from "@/types/positions";

const VALID_TABS: PipelineTab[] = ["unallocated", "budget", "site", "closed", "all"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get("tab") ?? "all") as PipelineTab;

    if (!VALID_TABS.includes(tab)) {
      return NextResponse.json({ error: `Invalid tab: ${tab}` }, { status: 400 });
    }

    const positions = await getBookPositions(bookId, tab);
    return NextResponse.json(positions);
  } catch (err) {
    console.error("[books/:id/positions] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
