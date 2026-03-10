"use client";

import { useSetupStore } from "@/store/setupStore";

export function ReviewStep() {
  const {
    orgName, baseCurrency, adminName, adminEmail,
    profile, hierarchyLevels, selectedCommodities,
    creating, error, clearError,
    createOrganization, setStep,
  } = useSetupStore();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Review & Create</h2>
        <p className="mt-1 text-sm text-muted">
          Verify your configuration before creating the organization.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive-20 bg-destructive-10 px-4 py-2.5">
          <span className="text-sm text-loss">{error}</span>
          <button onClick={clearError} className="text-xs text-loss hover:text-loss">Dismiss</button>
        </div>
      )}

      <div className="divide-y divide-b-default rounded-xl border border-b-default bg-surface">
        <Row label="Organization" value={orgName} />
        <Row label="Base Currency" value={baseCurrency} />
        <Row label="Administrator" value={`${adminName} (${adminEmail})`} />
        <Row label="Password" value="Set" />
        <Row label="Profile" value={profile?.display_name ?? "—"} />
        <Row
          label="Operating Model"
          value={
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
              profile?.operating_model === "margin"
                ? "bg-profit-10 text-profit"
                : "bg-action-10 text-action"
            }`}>
              {profile?.operating_model ?? "—"}
            </span>
          }
        />
        <Row
          label="Hierarchy"
          value={hierarchyLevels.map((l) => l.label).join(" → ")}
        />
        <Row
          label="Plugins"
          value={`${profile?.default_plugins.length ?? 0} enabled`}
        />
        <Row
          label="Commodities"
          value={`${selectedCommodities.length} selected`}
        />
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep(4)}
          disabled={creating}
          className="rounded-lg border border-b-input px-5 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-secondary disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={createOrganization}
          disabled={creating}
          className="rounded-lg bg-action px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-60"
        >
          {creating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </span>
          ) : (
            "Create Organization"
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-secondary text-right max-w-[60%]">{value}</span>
    </div>
  );
}
