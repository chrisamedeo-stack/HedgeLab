"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { usePlatformOrg } from "@/hooks/usePlatform";
import { usePlatformStore } from "@/store/platformStore";
import { OrgPluginsManager } from "@/components/platform/OrgPluginsManager";
import { SubscriptionEditor } from "@/components/platform/SubscriptionEditor";
import { UsersTab } from "@/components/admin/UsersTab";
import { StructureTab } from "@/components/admin/structure/StructureTab";
import { OrgSettingsTab } from "@/components/admin/OrgSettingsTab";
import { ConfirmDialog } from "@/components/admin/SharedUI";

const TABS = ["Overview", "Plugins", "Users", "Structure", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function OrgManagePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const router = useRouter();
  const { data: org, loading } = usePlatformOrg(orgId);
  const deactivateOrg = usePlatformStore((s) => s.deactivateOrg);
  const hardDeleteOrg = usePlatformStore((s) => s.hardDeleteOrg);
  const [tab, setTab] = useState<Tab>("Overview");
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showHardDeleteConfirm, setShowHardDeleteConfirm] = useState(false);

  function enterOrg() {
    localStorage.setItem("hedgelab-platform-org-id", orgId);
    router.push("/dashboard");
  }

  async function handleDeactivate() {
    await deactivateOrg(orgId);
    router.push("/platform");
  }

  async function handleHardDelete() {
    await hardDeleteOrg(orgId);
    router.push("/platform");
  }

  if (loading || !org) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-surface animate-pulse" />
        <div className="h-64 rounded-lg bg-surface border border-b-default animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/platform" className="text-muted hover:text-secondary transition-colors">
          Organizations
        </Link>
        <span className="text-faint">/</span>
        <span className="text-secondary">{org.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">{org.name}</h1>
          <p className="mt-0.5 text-xs text-faint">
            {org.profile_name ?? "No profile"} &middot; {org.base_currency} &middot;{" "}
            <span className={org.is_active ? "text-profit" : "text-faint"}>
              {org.is_active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHardDeleteConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white hover:bg-loss/80 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive-30 px-4 py-2 text-sm font-medium text-loss hover:bg-destructive-10 transition-colors"
          >
            Deactivate
          </button>
          <button
            onClick={enterOrg}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Enter Org
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-b-default">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? "border-action text-secondary"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Users", value: org.user_count, limit: org.max_users },
                { label: "Sites", value: org.site_count, limit: org.max_sites },
                { label: "Plugins", value: org.plugin_count },
                { label: "Currency", value: org.base_currency },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-b-default bg-surface p-4">
                  <p className="text-xs text-muted uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{s.value}</p>
                  {s.limit && (
                    <p className="text-xs text-faint mt-0.5">of {s.limit} max</p>
                  )}
                </div>
              ))}
            </div>

            {/* Subscription */}
            <SubscriptionEditor
              orgId={orgId}
              tier={org.subscription_tier}
              status={org.subscription_status}
              maxUsers={org.max_users}
              maxSites={org.max_sites}
              notes={org.notes}
            />

            {/* Enabled plugins summary */}
            <div className="bg-surface border border-b-default rounded-lg p-6">
              <h3 className="text-sm font-semibold text-secondary mb-3">Enabled Plugins</h3>
              {org.enabled_plugins.length === 0 ? (
                <p className="text-sm text-muted">No plugins enabled</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {org.enabled_plugins.map((p) => (
                    <span
                      key={p}
                      className="inline-flex px-2.5 py-1 rounded-md bg-action-10 text-xs font-medium text-action"
                    >
                      {p.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "Plugins" && <OrgPluginsManager orgId={orgId} />}
        {tab === "Users" && <UsersTab orgId={orgId} />}
        {tab === "Structure" && <StructureTab orgId={orgId} />}
        {tab === "Settings" && <OrgSettingsTab orgId={orgId} />}
      </div>

      {showDeactivateConfirm && (
        <ConfirmDialog
          title="Deactivate Organization"
          desc={`Deactivate "${org.name}"? All users will lose access. This can be reversed by reactivating later.`}
          onConfirm={handleDeactivate}
          onCancel={() => setShowDeactivateConfirm(false)}
        />
      )}

      {showHardDeleteConfirm && (
        <ConfirmDialog
          title="Permanently Delete Organization"
          desc={`Permanently delete "${org.name}" and ALL of its data (users, sites, trades, positions, budgets, market data)? This cannot be undone.`}
          onConfirm={handleHardDelete}
          onCancel={() => setShowHardDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
