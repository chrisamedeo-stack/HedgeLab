"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/import",
    label: "Import",
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-main text-primary">
      <aside className="flex w-60 flex-col border-r border-b-default bg-sidebar">
        <div className="flex h-14 items-center px-4 border-b border-b-default">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-action text-white text-xs font-bold">H</div>
            <span className="text-sm font-semibold text-primary">HedgeLab</span>
          </Link>
        </div>
        <div className="px-4 py-3 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">Admin</h2>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
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
        </nav>
        <div className="border-t border-b-default px-4 py-3">
          <Link href="/hedge-book" className="text-xs text-muted hover:text-secondary transition-colors">
            Position Manager
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-6 page-fade">
          {children}
        </div>
      </main>
    </div>
  );
}
