"use client";

import { useOrgScope } from "@/contexts/OrgScopeContext";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";

export function OrgBreadcrumb() {
  const { tiers, scope, setTierValue, getChildrenOfNode, loading } = useOrgScope();
  const orgHierarchy = useFeatureFlag("org_hierarchy");

  if (!orgHierarchy || loading) return null;

  // Skip tier 0 (Corporate) — always set, not selectable
  const selectableTiers = tiers.filter((t) => t.tier_level > 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {selectableTiers.map((tier) => {
        // Get parent node from the tier above
        const parentTierLevel = tier.tier_level - 1;
        const parentNodeId = scope[parentTierLevel] ?? null;

        // Get options: children of the selected parent
        const options = getChildrenOfNode(parentNodeId, tier.tier_level);

        // Only show this picker if the parent tier is selected (or it's tier 1)
        if (tier.tier_level > 1 && !scope[tier.tier_level - 1]) return null;

        return (
          <div key={tier.tier_level} className="flex items-center gap-1">
            {tier.tier_level > 1 && (
              <svg className="h-4 w-4 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
            <select
              value={scope[tier.tier_level] ?? ""}
              onChange={(e) => setTierValue(tier.tier_level, e.target.value || null)}
              className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">All {tier.tier_name_plural}</option>
              {options.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
