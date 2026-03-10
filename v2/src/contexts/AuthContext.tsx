"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  roleId: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// Pages that don't need auth
const PUBLIC_PATHS = ["/login", "/setup"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch current user on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (r.ok) return r.json();
        return { user: null };
      })
      .then((data) => {
        setUser(data.user ?? null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const loginFn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      setUser(data.user);
    },
    []
  );

  const logoutFn = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }, [router]);

  // Don't block rendering on public pages while loading
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  return (
    <AuthContext.Provider
      value={{ user, loading, login: loginFn, logout: logoutFn }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Get auth context. Throws if used outside AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Safe version — returns null outside AuthProvider (for shared components).
 */
export function useAuthSafe(): AuthContextValue | null {
  return useContext(AuthContext);
}
