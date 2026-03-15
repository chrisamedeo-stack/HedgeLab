"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { CommodityProvider, useCommodityContext } from "@/contexts/CommodityContext";
import { OrgProvider, useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { OrgImpersonationBanner } from "@/components/platform/OrgImpersonationBanner";
import { useCommodities } from "@/hooks/usePositions";
import { useEnabledPlugins } from "@/hooks/useOrgHierarchy";

// ─── Nav icon paths ──────────────────────────────────────────────────────

const NAV_ICONS: Record<string, string> = {
  "/dashboard":        "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "/coverage":         "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  "/position-manager": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "/trades":           "M3 10h18M3 6h18M3 14h18M3 18h18",
  "/contracts":        "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "/budget":           "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  "/market":           "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "/risk":             "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
  "/formulas":         "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 0V9a2 2 0 012-2h2a2 2 0 012 2v3.5M6 18H4m2 0h4m6 4v-2m0 2a2 2 0 100-4m0 4a2 2 0 110-4m0 0V9",
  "/logistics":        "M8 7h12l-3 7H8m0 0l-1.5 6M8 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3H20",
  "/settlement":       "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  "/energy":           "M13 10V3L4 14h7v7l9-11h-7z",
  "/forecast":         "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  "/sites":            "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "/import":           "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  "/settings":         "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  "/platform":         "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

function getIcon(href: string): string {
  return NAV_ICONS[href] ?? "M4 6h16M4 12h16M4 18h16";
}

// ─── Commodity Switcher ──────────────────────────────────────────────────

function CommoditySwitcher({ collapsed }: { collapsed: boolean }) {
  const { data: commodities } = useCommodities();
  const { commodityId, setCommodityId } = useCommodityContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!commodityId && commodities && commodities.length > 0) {
      setCommodityId(commodities[0].id);
    }
  }, [commodities, commodityId, setCommodityId]);

  const selected = commodities?.find((c) => c.id === commodityId);

  if (collapsed) {
    return (
      <div className="relative px-2 py-2 flex justify-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-input-bg text-xs font-bold text-secondary hover:bg-hover transition-colors"
          title={selected?.name ?? "Commodity"}
        >
          {selected?.name?.slice(0, 2).toUpperCase() ?? "??"}
        </button>
        {open && commodities && (
          <div className="absolute left-full top-0 z-50 ml-1 w-40 rounded-lg border border-b-default bg-surface shadow-lg">
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

  return (
    <div className="relative px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center rounded-lg bg-input-bg border border-b-input px-3 py-2 gap-2 text-sm font-medium hover:bg-hover transition-colors"
      >
        <span className="font-semibold text-primary">{selected?.name ?? "Select Commodity"}</span>
        <svg className="h-3.5 w-3.5 text-faint ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

// ─── Nav Link ────────────────────────────────────────────────────────────

function NavLink({ href, label, collapsed }: { href: string; label: string; collapsed: boolean }) {
  const pathname = usePathname();
  const basePath = href.split("?")[0];
  const active = pathname === basePath || pathname?.startsWith(basePath + "/");

  if (collapsed) {
    return (
      <Link
        href={href}
        title={label}
        className={`flex items-center justify-center h-10 w-full rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-action-10 text-secondary border-l-2 border-action"
            : "text-secondary hover:bg-input-bg hover:text-primary"
        }`}
      >
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={getIcon(href)} />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-action-10 text-secondary border-l-2 border-action"
          : "text-secondary hover:bg-input-bg hover:text-primary"
      }`}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={getIcon(href)} />
      </svg>
      <span>{label}</span>
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <p className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
  );
}

// ─── User Section ────────────────────────────────────────────────────────

function UserSection({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-b-default py-3 px-2 flex flex-col items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="text-faint hover:text-destructive transition-colors shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-b-default py-3 px-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-secondary truncate">{user?.name ?? "—"}</p>
          <p className="text-xs text-faint truncate">{user?.roleId ?? "—"}</p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="text-faint hover:text-destructive transition-colors shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────

// Plugin IDs that map to specific nav items
const PLUGIN_NAV: Record<string, { href: string; label: string; section: "trading" | "planning" }[]> = {
  "position_manager": [
    { href: "/position-manager", label: "Hedge Book", section: "trading" },
    { href: "/position-manager?tab=budget", label: "Allocations", section: "trading" },
  ],
  "trade_capture":    [{ href: "/trades",      label: "Trades",            section: "trading" }],
  "contracts":        [{ href: "/contracts",   label: "Contracts",         section: "trading" }],
  "formula_pricing":  [{ href: "/formulas",    label: "Formulas",          section: "trading" }],
  "logistics":        [{ href: "/logistics",   label: "Logistics",         section: "trading" }],
  "settlement":       [{ href: "/settlement",  label: "Settlement",        section: "trading" }],
  "budget":           [{ href: "/budget",      label: "Budget & Forecast", section: "planning" }],
  "market_data":      [{ href: "/market",      label: "Market View",       section: "planning" }],
  "risk":             [{ href: "/risk",        label: "Risk",              section: "planning" }],
  "energy":           [{ href: "/energy",      label: "Energy",            section: "planning" }],
  // forecast nav is handled as a tab inside "Budget & Forecast" — no standalone entry
};

const SIDEBAR_KEY = "sidebar-collapsed";

function Sidebar() {
  const { orgId, isPluginEnabled } = useOrgContext();
  const { user } = useAuth();
  const { data: plugins } = useEnabledPlugins(orgId);

  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // Build trading and planning sections from enabled plugins
  const tradingItems: { href: string; label: string }[] = [];
  const planningItems: { href: string; label: string }[] = [];

  if (plugins) {
    for (const p of plugins) {
      if (!p.is_enabled) continue;
      const mappings = PLUGIN_NAV[p.id];
      if (!mappings) continue;
      for (const mapping of mappings) {
        const target = mapping.section === "trading" ? tradingItems : planningItems;
        target.push({ href: mapping.href, label: mapping.label });
      }
    }
  }

  // Fallback: if plugins haven't loaded yet, show the core items
  const showTrading = tradingItems.length > 0 ? tradingItems : [
    { href: "/position-manager", label: "Hedge Book" },
    { href: "/trades", label: "Trades" },
    { href: "/contracts", label: "Contracts" },
  ];

  const showPlanning = planningItems.length > 0 ? planningItems : [
    { href: "/budget", label: "Budget & Forecast" },
    { href: "/market", label: "Market Data" },
  ];

  return (
    <aside className={`flex flex-col shrink-0 h-screen bg-sidebar border-r border-b-default transition-all duration-200 ease-in-out ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo */}
      <div className={`flex h-14 items-center shrink-0 border-b border-b-default ${collapsed ? "justify-center px-0" : "px-4 gap-3"}`}>
        <Link href="/" className="flex items-center gap-3">
          <Image src="/hedgelab-icon.png" alt="HL" width={28} height={28} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold text-primary tracking-tight">HedgeLab</span>}
        </Link>
      </div>

      {/* Commodity Switcher */}
      <div className="border-b border-b-default">
        <CommoditySwitcher collapsed={collapsed} />
      </div>

      {/* Nav Sections — scrollable */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {/* Overview */}
        <div>
          <SectionLabel label="Overview" collapsed={collapsed} />
          <div className="space-y-0.5">
            <NavLink href="/dashboard" label="Dashboard" collapsed={collapsed} />
            <NavLink href="/coverage" label="Coverage" collapsed={collapsed} />
          </div>
        </div>

        {/* Trading */}
        <div>
          <SectionLabel label="Trading" collapsed={collapsed} />
          <div className="space-y-0.5">
            {showTrading.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Planning */}
        <div>
          <SectionLabel label="Planning" collapsed={collapsed} />
          <div className="space-y-0.5">
            {showPlanning.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} collapsed={collapsed} />
            ))}
          </div>
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className={`px-2 pb-2 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-faint hover:bg-input-bg hover:text-primary transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* System — pinned bottom */}
      <div className="shrink-0 border-t border-b-default px-2 py-3">
        <SectionLabel label="System" collapsed={collapsed} />
        <div className="space-y-0.5">
          <NavLink href="/sites" label="Sites" collapsed={collapsed} />
          <NavLink href="/import" label="Import" collapsed={collapsed} />
          <NavLink href="/settings" label="Settings" collapsed={collapsed} />
          {user?.roleId === "admin" && (
            <NavLink href="/platform" label="Platform Admin" collapsed={collapsed} />
          )}
        </div>
      </div>

      {/* User section */}
      <UserSection collapsed={collapsed} />
    </aside>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto bg-main">
      <OrgImpersonationBanner />
      <div className="page-fade p-6">
        {children}
      </div>
    </main>
  );
}

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <CommodityProvider>
        <div className="flex min-h-screen bg-main text-primary">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
      </CommodityProvider>
    </OrgProvider>
  );
}
