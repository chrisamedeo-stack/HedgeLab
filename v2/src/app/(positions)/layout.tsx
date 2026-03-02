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
      { href: "/coverage", label: "Coverage", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/budget", label: "Budget & Forecast", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    ],
  },
  {
    label: "Execution",
    items: [
      { href: "/trades", label: "Trades", icon: "M3 10h18M3 6h18M3 14h18M3 18h18" },
      { href: "/hedge-book", label: "Hedge Book", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/sites", label: "Sites", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
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
        <Link
          href="/import"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/import"
              ? "bg-action-10 text-secondary border-l-2 border-action"
              : "text-muted hover:bg-input-bg hover:text-secondary"
          }`}
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import
        </Link>
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
