"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { CommodityProvider, useCommodityContext } from "@/contexts/CommodityContext";
import { useCommodities } from "@/hooks/usePositions";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { href: "/coverage", label: "Coverage", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/budget", label: "Budget & Forecast", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { href: "/contracts", label: "Contracts", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    ],
  },
  {
    label: "Execution",
    items: [
      { href: "/trades", label: "Trades", icon: "M3 10h18M3 6h18M3 14h18M3 18h18" },
      { href: "/hedge-book", label: "Hedge Book", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
      { href: "/efp", label: "EFP / Locked", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/sites", label: "Sites", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { href: "/receipts", label: "Receipts", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { href: "/roll-candidates", label: "Roll Candidates", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/market", label: "Market Data", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
    ],
  },
];

function CommoditySwitcher() {
  const { data: commodities } = useCommodities();
  const { commodityId, setCommodityId } = useCommodityContext();
  const [open, setOpen] = useState(false);

  // Auto-select first commodity if none selected
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

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col bg-sidebar border-r border-b-default">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-b-default">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-action text-white text-xs font-bold">H</div>
          <span className="text-sm font-semibold text-primary">HedgeLab</span>
        </Link>
      </div>

      {/* Commodity Switcher */}
      <div className="border-b border-b-default">
        <CommoditySwitcher />
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
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
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
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
  );
}
