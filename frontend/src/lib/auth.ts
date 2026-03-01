import type { AuthResponse, LoginRequest } from "@/types/auth";

const TOKEN_KEY  = "hl_token";
const USER_KEY   = "hl_user";
const EXPIRY_KEY = "hl_token_expiry";

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Login failed");
  }
  const data: AuthResponse = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
    localStorage.setItem(EXPIRY_KEY, data.expiresAt);
  }
  return data;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): { username: string; role: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Returns token expiry as epoch ms, or null if not available */
export function getTokenExpiry(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EXPIRY_KEY);
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? null : ms;
}

/** Refreshes the session by calling /api/v1/auth/me. Returns true on success. */
export async function refreshSession(): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) return false;
    const res = await fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data: AuthResponse = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
    localStorage.setItem(EXPIRY_KEY, data.expiresAt);
    return true;
  } catch {
    return false;
  }
}
