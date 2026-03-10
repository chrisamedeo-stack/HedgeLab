import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { cookies } from "next/headers";

const COOKIE_NAME = "hedgelab-token";

export async function POST() {
  try {
    const user = await getCurrentUser();

    // Clear cookie
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    // Audit log if we had a valid user
    if (user) {
      await auditLog({
        orgId: user.orgId,
        userId: user.id,
        module: "auth",
        entityType: "session",
        entityId: user.id,
        action: "logout",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/logout] error:", err);
    // Clear cookie even on error
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ success: true });
  }
}
