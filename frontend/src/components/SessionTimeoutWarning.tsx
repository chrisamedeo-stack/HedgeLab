"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getTokenExpiry, refreshSession, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { btnCancel } from "@/lib/corn-format";

const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function SessionTimeoutWarning() {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const checkExpiry = useCallback(() => {
    const expiry = getTokenExpiry();
    if (!expiry) return;
    const remaining = expiry - Date.now();
    setRemainingMs(remaining);

    if (remaining <= 0) {
      logout();
      router.push("/login");
      return;
    }

    if (remaining <= WARNING_THRESHOLD_MS) {
      setShowWarning(true);
    }
  }, [router]);

  useEffect(() => {
    checkExpiry();
    const id = setInterval(checkExpiry, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkExpiry]);

  // When warning is shown, update countdown more frequently
  useEffect(() => {
    if (!showWarning) return;
    const id = setInterval(() => {
      const expiry = getTokenExpiry();
      if (!expiry) return;
      const remaining = expiry - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        logout();
        router.push("/login");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [showWarning, router]);

  async function handleStayLoggedIn() {
    setRefreshing(true);
    const ok = await refreshSession();
    setRefreshing(false);
    if (ok) {
      setShowWarning(false);
      setRemainingMs(null);
    } else {
      logout();
      router.push("/login");
    }
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!showWarning || remainingMs === null) return null;

  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-surface border border-b-default rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-primary">Session Expiring</h2>
        <p className="text-sm text-muted mt-2">
          Your session will expire in{" "}
          <span className="font-mono font-semibold text-warning">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          . Would you like to stay logged in?
        </p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(btnCancel)}
          >
            Log out
          </button>
          <button
            type="button"
            onClick={handleStayLoggedIn}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-action hover:bg-action-hover text-white transition-colors disabled:opacity-50"
          >
            {refreshing && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}
