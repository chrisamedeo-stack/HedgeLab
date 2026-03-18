"use client";

import { TabGroup } from "@/components/ui/TabGroup";
import type { PipelineTab } from "@/types/positions";

interface PipelineTabsProps {
  active: PipelineTab;
  onChange: (tab: PipelineTab) => void;
}

const TABS: { key: PipelineTab; label: string }[] = [
  { key: "unallocated", label: "Unallocated" },
  { key: "budget", label: "Budget" },
  { key: "site", label: "Site" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

export function PipelineTabs({ active, onChange }: PipelineTabsProps) {
  return (
    <TabGroup
      tabs={TABS}
      active={active}
      onChange={(key) => onChange(key as PipelineTab)}
    />
  );
}
