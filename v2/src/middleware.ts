import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "hedgelab-token";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return new TextEncoder().encode("fallback-dev-secret");
  return new TextEncoder().encode(secret);
}

// Paths that never require auth
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/hedgelab-icon.png",
];

// Paths that are accessible pre-auth (setup flow, kernel bootstrap)
const SETUP_PATHS = [
  "/setup",
  "/api/kernel/organizations",
  "/api/kernel/migrate",
  "/api/kernel/customer-profiles",
  "/api/kernel/commodities",
];

// Paths restricted to admin role
const ADMIN_PATHS = ["/platform", "/api/platform/"];

// Static file extensions to skip
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".css", ".js", ".woff", ".woff2"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }

  // Allow setup paths (no users exist yet during setup)
  if (SETUP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return handleUnauthenticated(request, pathname);
  }

  // Verify JWT
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // Admin-only paths
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
      if (payload.roleId !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token
    return handleUnauthenticated(request, pathname);
  }
}

function handleUnauthenticated(request: NextRequest, pathname: string) {
  // API routes get 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Pages redirect to login with return URL
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all paths except static files in public/
    "/((?!_next/static|_next/image).*)",
  ],
};
