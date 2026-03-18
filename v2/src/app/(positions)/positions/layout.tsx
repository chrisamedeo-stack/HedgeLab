"use client";

import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { OrgScopeProvider } from "@/contexts/OrgScopeContext";

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureFlagProvider>
      <OrgScopeProvider>
        {children}
      </OrgScopeProvider>
    </FeatureFlagProvider>
  );
}
