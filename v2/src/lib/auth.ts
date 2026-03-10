import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { queryOne, query } from "@/lib/db";
import { cookies } from "next/headers";

// ─── Constants ──────────────────────────────────────────────────────────────

const COOKIE_NAME = "hedgelab-token";
const TOKEN_EXPIRY = "8h";
const SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  roleId: string;
}

export interface TokenPayload extends JWTPayload {
  sub: string;       // user id
  email: string;
  name: string;
  orgId: string;
  roleId: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Password Hashing ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ────────────────────────────────────────────────────────────────────

export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
    roleId: user.roleId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as TokenPayload;
}

// ─── Login ──────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const row = await queryOne<{
    id: string;
    email: string;
    name: string;
    org_id: string;
    role_id: string;
    password_hash: string | null;
    is_active: boolean;
  }>(
    `SELECT id, email, name, org_id, role_id, password_hash, is_active
     FROM users WHERE email = $1`,
    [email]
  );

  if (!row) throw new AuthError("Invalid email or password");
  if (!row.is_active) throw new AuthError("Account is disabled");
  if (!row.password_hash) throw new AuthError("Password not set. Use the seed-password endpoint first.");

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) throw new AuthError("Invalid email or password");

  // Update last_login_at
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [row.id]);

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    orgId: row.org_id,
    roleId: row.role_id,
  };

  const token = await createToken(user);
  return { user, token };
}

// ─── Cookie Helpers ─────────────────────────────────────────────────────────

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Current User (for API routes) ─────────────────────────────────────────

/**
 * Get the current authenticated user from the request cookie.
 * Throws AuthError if not authenticated.
 */
export async function getApiUser(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new AuthError("Not authenticated");

  try {
    const payload = await verifyToken(token);
    return {
      id: payload.sub!,
      email: payload.email,
      name: payload.name,
      orgId: payload.orgId,
      roleId: payload.roleId,
    };
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

/**
 * Get the current user, or null if not authenticated.
 * Does not throw — useful for optional auth checks.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getApiUser();
  } catch {
    return null;
  }
}
