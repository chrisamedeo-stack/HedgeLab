"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import type { FeatureFlag } from "@/types/pm";

interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (flag: FeatureFlag) => boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { orgId } = useOrgContext();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/org/features?orgId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags ?? {});
      }
    } catch (err) {
      console.error("[FeatureFlagContext] Failed to load flags:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (flag: FeatureFlag) => flags[flag] ?? false,
    [flags]
  );

  return (
    <FeatureFlagContext.Provider value={{ flags, loading, isEnabled, refresh: fetchFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagProvider");
  return ctx;
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flag);
}
