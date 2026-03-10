import { NextResponse } from "next/server";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platformService";

/** GET — Platform-level settings */
export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[platform/settings] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** PATCH — Update platform-level settings */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const updated = await updatePlatformSettings(body);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[platform/settings] PATCH error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
