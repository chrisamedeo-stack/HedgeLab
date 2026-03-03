"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated, logout, getUser, getTokenExpiry, refreshSession } from "@/lib/auth";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  KeyRound,
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
import { ChangePasswordDialog } from "@/components/ui/ChangePasswordDialog";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { COMMODITY_SLUGS, getCommodityConfig } from "@/lib/commodity-config";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function buildNavSections(commodity: string): NavSection[] {
  return [
    {
      label: "Overview",
      items: [
        { href: "/dashboard",               label: "Dashboard",   icon: LayoutDashboard },
        { href: `/${commodity}/coverage`,    label: "Coverage",    icon: BarChart2 },
      ],
    },
    {
      label: "Planning",
      items: [
        { href: `/${commodity}/budget`, label: "Budgets & Forecasts", icon: BookOpen },
      ],
    },
    {
      label: "Execution",
      items: [
        { href: `/${commodity}/positions`, label: "Position Manager", icon: Activity },
        { href: `/${commodity}/contracts`, label: "Contracts",        icon: FileText },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: `/${commodity}/sites`,    label: "Sites",    icon: MapPin },
        { href: `/${commodity}/efp`,      label: "EFP",      icon: ArrowLeftRight },
        { href: `/${commodity}/receipts`, label: "Receipts", icon: Package },
      ],
    },
    {
      label: "Market",
      items: [
        { href: "/market-data", label: "Market Data", icon: TrendingUp },
      ],
    },
    {
      label: "Admin",
      items: [
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];
}

/** Extract the commodity slug from the pathname, e.g. "/corn/positions" → "corn" */
function detectCommodity(pathname: string): string {
  const seg = pathname.split("/")[1]; // first segment after leading /
  if (seg && COMMODITY_SLUGS.includes(seg)) return seg;
  return COMMODITY_SLUGS[0]; // default to first commodity (corn)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const activeCommodity = detectCommodity(pathname);
  const navSections = buildNavSections(activeCommodity);

  // Initialize from safe defaults — read localStorage in useEffect to avoid hydration mismatch
  const [user, setUser]           = useState<ReturnType<typeof getUser>>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [commodityOpen, setCommodityOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    setMounted(true);
    if (!isAuthenticated()) {
      router.push("/login");
    } else if (!getTokenExpiry()) {
      // Backfill expiry for sessions created before the timeout feature
      refreshSession();
    }
  }, [router]);

  /** Switch commodity — navigate to the same sub-page under the new slug */
  function switchCommodity(slug: string) {
    setCommodityOpen(false);
    if (slug === activeCommodity) return;
    // Try to preserve the current sub-path (e.g. /corn/positions → /soybeans/positions)
    const segments = pathname.split("/");
    if (segments.length >= 3 && COMMODITY_SLUGS.includes(segments[1])) {
      segments[1] = slug;
      router.push(segments.join("/"));
    } else {
      router.push(`/${slug}/coverage`);
    }
  }

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
          "bg-sidebar border-r border-b-default flex flex-col shrink-0 transition-all duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-b-default h-14 shrink-0",
          collapsed ? "justify-center px-0" : "px-4 gap-3"
        )}>
          <Image
            src="/hedgelab-icon.png"
            alt="HL"
            width={28}
            height={28}
            className="shrink-0"
          />
          {!collapsed && (
            <span className="text-sm font-semibold text-primary tracking-tight">HedgeLab</span>
          )}
        </div>

        {/* Commodity switcher */}
        <div className="px-2 pt-2">
          <div className="relative">
            <button
              onClick={() => setCommodityOpen((p) => !p)}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium transition-colors bg-input-bg hover:bg-hover border border-b-input",
                collapsed ? "justify-center h-10 px-0" : "px-3 py-2 gap-2"
              )}
              title={collapsed ? getCommodityConfig(activeCommodity).label : undefined}
            >
              <span className={cn("font-semibold text-primary", collapsed && "text-xs")}>
                {collapsed
                  ? getCommodityConfig(activeCommodity).label.slice(0, 2).toUpperCase()
                  : getCommodityConfig(activeCommodity).label}
              </span>
              {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-faint ml-auto" />}
            </button>
            {commodityOpen && (
              <div className="absolute z-50 mt-1 left-0 w-full bg-surface border border-b-input rounded-lg shadow-lg overflow-hidden">
                {COMMODITY_SLUGS.map((slug) => {
                  const cfg = getCommodityConfig(slug);
                  return (
                    <button
                      key={slug}
                      onClick={() => switchCommodity(slug)}
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm transition-colors",
                        slug === activeCommodity
                          ? "bg-action-10 text-secondary font-medium"
                          : "text-secondary hover:bg-hover"
                      )}
                    >
                      {collapsed ? cfg.label.slice(0, 2).toUpperCase() : cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">
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
                          ? "bg-action-10 text-secondary border-l-2 border-action"
                          : "text-secondary hover:bg-input-bg hover:text-primary"
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
            <div className={cn("flex items-center gap-2", collapsed && "flex-row")}>
              <button
                onClick={() => setShowPasswordDialog(true)}
                title="Change password"
                className="text-faint hover:text-primary transition-colors shrink-0"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-faint hover:text-destructive transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-main">
        <div className="page-fade p-6">{children}</div>
      </main>

      <ChangePasswordDialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} />
      <SessionTimeoutWarning />
    </div>
  );
}
