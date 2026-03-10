import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

/**
 * One-time endpoint to set a password for an existing user who has no password.
 * Used after running the 020_auth migration to bootstrap the admin account.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find the user
    const user = await queryOne<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Only allow seeding if no password is set yet
    if (user.password_hash) {
      return NextResponse.json(
        { error: "Password already set for this user" },
        { status: 409 }
      );
    }

    const hash = await hashPassword(password);
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, user.id]
    );

    return NextResponse.json({ success: true, message: "Password set successfully" });
  } catch (err) {
    console.error("[auth/seed-password] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
