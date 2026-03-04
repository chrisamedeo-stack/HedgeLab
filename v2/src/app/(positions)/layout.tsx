"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { CommodityProvider, useCommodityContext } from "@/contexts/CommodityContext";
import { OrgProvider, useOrgContext } from "@/contexts/OrgContext";
import { useCommodities } from "@/hooks/usePositions";
import { useNavConfig } from "@/hooks/useOrgHierarchy";
import type { OrgTreeNode } from "@/types/org";

// ─── Icons for core nav items (not plugin-driven) ────────────────────────

const CORE_ICONS: Record<string, string> = {
  "/dashboard": "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "/coverage": "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  "/sites": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "/receipts": "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  "/roll-candidates": "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  "/efp": "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

// Plugin-driven icons by nav_href
const PLUGIN_ICONS: Record<string, string> = {
  "/hedge-book": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "/trades": "M3 10h18M3 6h18M3 14h18M3 18h18",
  "/budget": "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  "/market": "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "/formulas": "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 0V9a2 2 0 012-2h2a2 2 0 012 2v3.5M6 18H4m2 0h4m6 4v-2m0 2a2 2 0 100-4m0 4a2 2 0 110-4m0 0V9",
  "/risk": "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
  "/forecast": "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  "/contracts": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "/logistics": "M8 7h12l-3 7H8m0 0l-1.5 6M8 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3H20",
  "/settlement": "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  "/energy": "M13 10V3L4 14h7v7l9-11h-7z",
};

function getIcon(href: string): string {
  return CORE_ICONS[href] ?? PLUGIN_ICONS[href] ?? "M4 6h16M4 12h16M4 18h16";
}

// ─── Commodity Switcher ──────────────────────────────────────────────────

function CommoditySwitcher() {
  const { data: commodities } = useCommodities();
  const { commodityId, setCommodityId } = useCommodityContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!commodityId && commodities && commodities.length > 0) {
      setCommodityId(commodities[0].id);
    }
  }, [commodities, commodityId, setCommodityId]);

  const selected = commodities?.find((c) => c.id === commodityId);

  return (
    <div className="relative px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-input-bg px-3 py-2 text-sm text-secondary hover:bg-hover transition-colors"
      >
        <span className="font-medium">{selected?.name ?? "Select Commodity"}</span>
        <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      </button>
      {open && commodities && (
        <div className="absolute left-3 right-3 z-50 mt-1 rounded-lg border border-b-default bg-surface shadow-lg">
          {commodities.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCommodityId(c.id); setOpen(false); }}
              className={`flex w-full items-center px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                c.id === commodityId
                  ? "bg-action-10 text-secondary"
                  : "text-muted hover:bg-hover hover:text-secondary"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Org Tree Nav ────────────────────────────────────────────────────────

function OrgTreeNav() {
  const { orgId, orgTree, selectedOrgUnit, setSelectedOrgUnit, groupingLevelLabel } = useOrgContext();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const stored = localStorage.getItem("hedgelab-org-tree-expanded");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("hedgelab-org-tree-expanded", JSON.stringify([...next]));
      return next;
    });
  }

  if (!orgTree.length) return null;

  return (
    <div className="mb-1">
      <div className="px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
          {groupingLevelLabel}
        </span>
      </div>
      {orgTree.map((node) => (
        <OrgTreeItem
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          toggleExpand={toggleExpand}
          selectedOrgUnit={selectedOrgUnit}
          setSelectedOrgUnit={setSelectedOrgUnit}
        />
      ))}
    </div>
  );
}

function OrgTreeItem({
  node,
  depth,
  expanded,
  toggleExpand,
  selectedOrgUnit,
  setSelectedOrgUnit,
}: {
  node: OrgTreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedOrgUnit: string | null;
  setSelectedOrgUnit: (id: string | null) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0 || node.sites.length > 0;
  const isSelected = selectedOrgUnit === node.id;

  return (
    <div>
      <button
        onClick={() => setSelectedOrgUnit(isSelected ? null : node.id)}
        className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          isSelected
            ? "bg-action-10 text-secondary"
            : "text-muted hover:bg-input-bg hover:text-secondary"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
            className="shrink-0 text-faint hover:text-muted cursor-pointer"
          >
            <svg
              className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
        {!hasChildren && <span className="w-3" />}
        <svg className="h-3.5 w-3.5 shrink-0 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
        <span className="truncate">{node.name}</span>
        {node.sites.length > 0 && (
          <span className="ml-auto text-xs text-faint">{node.sites.length}</span>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OrgTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedOrgUnit={selectedOrgUnit}
              setSelectedOrgUnit={setSelectedOrgUnit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dynamic Sidebar ────────────────────────────────────────────────────

function Sidebar() {
  const pathname = usePathname();
  const { orgId, isPluginEnabled } = useOrgContext();
  const { data: navConfig } = useNavConfig(orgId);

  // Core nav items always visible
  const coreItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/coverage", label: "Coverage" },
  ];

  // Operations items that are always visible (not plugin-gated)
  const coreOpsItems = [
    { href: "/sites", label: "Sites" },
    { href: "/receipts", label: "Receipts" },
    { href: "/roll-candidates", label: "Roll Candidates" },
    { href: "/efp", label: "EFP / Locked" },
  ];

  return (
    <aside className="flex w-60 flex-col bg-sidebar border-r border-b-default">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-b-default">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/hedgelab-icon.png" alt="HL" width={28} height={28} className="shrink-0" />
          <span className="text-sm font-semibold text-primary tracking-tight">HedgeLab</span>
        </Link>
      </div>

      {/* Commodity Switcher */}
      <div className="border-b border-b-default">
        <CommoditySwitcher />
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* Overview (always visible) */}
        <div className="mb-1">
          <div className="px-4 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Overview</span>
          </div>
          {coreItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mx-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-action-10 text-secondary border-l-2 border-action"
                    : "text-muted hover:bg-input-bg hover:text-secondary"
                }`}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={getIcon(item.href)} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Org Hierarchy Tree */}
        <OrgTreeNav />

        {/* Plugin-driven nav sections */}
        {navConfig?.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                {section.label}
              </span>
            </div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-action-10 text-secondary border-l-2 border-action"
                      : "text-muted hover:bg-input-bg hover:text-secondary"
                  }`}
                >
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={getIcon(item.href)} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Operations (always visible) */}
        <div className="mb-1">
          <div className="px-4 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Operations</span>
          </div>
          {coreOpsItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mx-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-action-10 text-secondary border-l-2 border-action"
                    : "text-muted hover:bg-input-bg hover:text-secondary"
                }`}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={getIcon(item.href)} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom links */}
      <div className="border-t border-b-default px-2 py-2 space-y-0.5">
        {[
          { href: "/import", label: "Import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
          { href: "/exports", label: "Exports", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" },
          { href: "/audit", label: "Audit Log", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
          { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === item.href || pathname?.startsWith(item.href + "/")
                ? "bg-action-10 text-secondary border-l-2 border-action"
                : "text-muted hover:bg-input-bg hover:text-secondary"
            }`}
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </div>

      {/* User section */}
      <div className="border-t border-b-default px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-white text-xs font-bold shrink-0">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-secondary truncate">System Admin</p>
            <p className="text-xs text-faint truncate">admin</p>
          </div>
          <button title="Sign out" className="text-faint hover:text-loss transition-colors shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <CommodityProvider>
        <div className="flex min-h-screen bg-main text-primary">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl px-6 py-6 page-fade">
              {children}
            </div>
          </main>
        </div>
      </CommodityProvider>
    </OrgProvider>
  );
}
