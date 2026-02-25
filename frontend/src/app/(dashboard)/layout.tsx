"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated, logout, getUser } from "@/lib/auth";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Layers,
  ShieldAlert,
  TrendingUp,
  ScrollText,
  Download,
  ChevronLeft,
  ChevronRight,
  LogOut,

  FileText,
  BarChart2,
  Package,
  Activity,
  BookOpen,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",     label: "Dashboard",   icon: LayoutDashboard },
      { href: "/corn/coverage", label: "Coverage",    icon: BarChart2 },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/corn/budget", label: "Budgets & Forecasts", icon: BookOpen },
    ],
  },
  {
    label: "Execution",
    items: [
      { href: "/corn/positions", label: "Position Manager", icon: Activity },
      { href: "/corn/contracts", label: "Contracts",        icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/corn/sites",    label: "Sites",    icon: MapPin },
      { href: "/corn/efp",      label: "EFP",      icon: ArrowLeftRight },
      { href: "/corn/receipts", label: "Receipts", icon: Package },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  // Initialize from safe defaults — read localStorage in useEffect to avoid hydration mismatch
  const [user, setUser]           = useState<ReturnType<typeof getUser>>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setUser(getUser());
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    setMounted(true);
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  // Only show user-specific content after client mount to prevent hydration mismatch
  const initials = mounted ? (user?.username?.slice(0, 2).toUpperCase() ?? "HL") : "HL";

  return (
    <div className="flex h-screen bg-main">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-surface border-r border-b-default flex flex-col shrink-0 transition-all duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-b-default h-14 shrink-0",
          collapsed ? "justify-center px-0" : "px-4 gap-3"
        )}>
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-action text-white font-bold text-sm shrink-0">
            HL
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-primary tracking-tight">HedgeLab</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-xs font-semibold text-ph uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center h-10 w-full px-0" : "px-3 py-2 gap-3",
                        active
                          ? "bg-action-10 text-action border-l-2 border-action"
                          : "text-faint hover:bg-input-bg hover:text-primary"
                      )}
                    >
                      <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className={cn("px-2 pb-2", collapsed && "flex justify-center")}>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-faint hover:bg-input-bg hover:text-primary transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* User section */}
        <div className={cn(
          "border-t border-b-default py-3 shrink-0",
          collapsed ? "px-2 flex flex-col items-center gap-2" : "px-3"
        )}>
          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-3")}>
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-action text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-secondary truncate">{user?.username}</p>
                <p className="text-xs text-faint truncate">{user?.role}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-faint hover:text-destructive transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-main">
        <div className="page-fade p-6">{children}</div>
      </main>
    </div>
  );
}
