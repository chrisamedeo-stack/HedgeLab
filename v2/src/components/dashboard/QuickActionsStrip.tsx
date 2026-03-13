"use client";

import Link from "next/link";
import { useOrgContext } from "@/contexts/OrgContext";

const ALL_ACTIONS = [
  { href: "/trades", label: "Book Trade", plugin: "trade_capture", icon: "M12 4v16m8-8H4" },
  { href: "/position-manager", label: "Positions", plugin: "position_manager", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/budget", label: "Budget", plugin: "budget", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/coverage", label: "Coverage", plugin: null, icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/contracts", label: "Contracts", plugin: "contracts", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/import", label: "Import", plugin: "ai_import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
];

export function QuickActionsStrip() {
  const { isPluginEnabled } = useOrgContext();
  const links = ALL_ACTIONS.filter((l) => !l.plugin || isPluginEnabled(l.plugin));

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex items-center gap-2 rounded-lg border border-b-default bg-surface px-4 py-2.5 text-sm font-medium text-secondary hover:border-b-input hover:bg-hover transition-colors"
        >
          <svg className="h-4 w-4 text-action" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
          </svg>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
