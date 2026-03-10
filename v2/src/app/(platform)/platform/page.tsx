"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlatformOrgs, usePlatformStats } from "@/hooks/usePlatform";

const TIER_COLORS: Record<string, string> = {
  standard: "bg-input-bg text-muted",
  professional: "bg-action-20 text-action",
  enterprise: "bg-profit-20 text-profit",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-profit-20 text-profit",
  suspended: "bg-warning-20 text-warning",
  inactive: "bg-input-bg text-faint",
};

export default function PlatformPage() {
  const router = useRouter();
  const { data: orgs, loading } = usePlatformOrgs();
  const { data: stats } = usePlatformStats();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = orgs.filter((o) => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "active" && !o.is_active) return false;
    if (statusFilter === "inactive" && o.is_active) return false;
    return true;
  });

  function enterOrg(orgId: string) {
    localStorage.setItem("hedgelab-platform-org-id", orgId);
    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Platform Admin</h1>
          <p className="text-sm text-muted mt-1">Manage customer organizations</p>
        </div>
        <Link
          href="/platform/orgs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Organization
        </Link>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Organizations", value: stats.total_orgs, sub: `${stats.active_orgs} active` },
            { label: "Total Users", value: stats.total_users },
            { label: "Total Sites", value: stats.total_sites },
            { label: "Active Rate", value: stats.total_orgs > 0 ? `${Math.round((stats.active_orgs / stats.total_orgs) * 100)}%` : "—" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-b-default bg-surface p-4">
              <p className="text-xs text-muted uppercase tracking-wider">{kpi.label}</p>
              <p className="text-2xl font-bold text-primary mt-1">{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-faint mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search organizations..."
          className="w-64 bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs text-faint ml-auto">{filtered.length} organizations</span>
      </div>

      {/* Org Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface border border-b-default animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-b-default rounded-lg bg-surface">
          <p className="text-sm text-muted">No organizations found</p>
          <Link
            href="/platform/orgs/new"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors"
          >
            Create your first organization
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/50 border-b border-b-default">
                {["Name", "Profile", "Tier", "Status", "Users", "Sites", "Plugins", "Created", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {filtered.map((org) => (
                <tr key={org.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-medium text-secondary">{org.name}</td>
                  <td className="px-3 py-3 text-muted">{org.profile_name ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[org.subscription_tier] ?? TIER_COLORS.standard}`}>
                      {org.subscription_tier}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${org.is_active ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                      {org.is_active ? org.subscription_status : "inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted">{org.user_count}</td>
                  <td className="px-3 py-3 text-muted">{org.site_count}</td>
                  <td className="px-3 py-3 text-muted">{org.plugin_count}</td>
                  <td className="px-3 py-3 text-faint text-xs">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/platform/orgs/${org.id}`}
                        className="text-xs text-action hover:text-action-hover transition-colors font-medium"
                      >
                        Manage
                      </Link>
                      <button
                        onClick={() => enterOrg(org.id)}
                        className="text-xs text-muted hover:text-secondary transition-colors font-medium"
                      >
                        Enter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
