import { NextResponse } from "next/server";
import { login, AuthError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { cookies } from "next/headers";

const COOKIE_NAME = "hedgelab-token";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { user, token } = await login(email, password);

    // Set httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    // Audit log
    await auditLog({
      orgId: user.orgId,
      userId: user.id,
      module: "auth",
      entityType: "session",
      entityId: user.id,
      action: "login",
      after: { email: user.email },
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[auth/login] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
