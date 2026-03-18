"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";

export function PositionToggle() {
  const pathname = usePathname();
  const showPhysical = useFeatureFlag("physical_positions");

  const tabs = [
    { key: "financial", label: "Financial", href: "/positions/financial" },
    ...(showPhysical
      ? [{ key: "physical", label: "Physical", href: "/positions/physical" }]
      : []),
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
      {tabs.map((tab) => {
        const active = pathname?.includes(tab.key);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              active
                ? "bg-action text-white"
                : "text-muted hover:text-primary hover:bg-hover"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
