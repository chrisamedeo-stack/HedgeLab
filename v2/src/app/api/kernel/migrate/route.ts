import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/migrate";

export async function POST() {
  try {
    const applied = await runMigrations();
    return NextResponse.json({
      success: true,
      applied,
      message: applied.length > 0
        ? `Applied ${applied.length} migration(s)`
        : "No new migrations",
    });
  } catch (err) {
    console.error("[migrate] Error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
