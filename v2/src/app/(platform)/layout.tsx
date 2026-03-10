"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/platform",
    label: "Organizations",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    href: "/platform/settings",
    label: "Settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-main text-primary">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-sidebar border-r border-b-default">
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-b-default">
          <Link href="/platform" className="flex items-center gap-2">
            <Image src="/hedgelab-icon.png" alt="HL" width={28} height={28} className="shrink-0" />
            <span className="text-sm font-semibold text-primary tracking-tight">HedgeLab</span>
          </Link>
        </div>

        {/* Platform badge */}
        <div className="px-4 py-3 border-b border-b-default">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-action-20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-action">
              Platform Admin
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="mb-1">
            <div className="px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Management</span>
            </div>
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/platform"
                ? pathname === "/platform"
                : pathname?.startsWith(item.href);
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
        </nav>

        {/* Back to app */}
        <div className="border-t border-b-default px-2 py-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-input-bg hover:text-secondary transition-colors"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-6 page-fade">
          {children}
        </div>
      </main>
    </div>
  );
}
