"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { useSetupStore } from "@/store/setupStore";
import { API_BASE } from "@/lib/api";
import type { CustomerProfile, HierarchyTemplateLevel } from "@/types/org";
import type { CreateOrganizationRequest, CreateOrganizationResponse } from "@/types/setup";

import { StepIndicator } from "@/components/setup/StepIndicator";
import { OrgInfoStep } from "@/components/setup/OrgInfoStep";
import { ProfileStep } from "@/components/setup/ProfileStep";
import { HierarchyStep } from "@/components/setup/HierarchyStep";
import { CommodityStep } from "@/components/setup/CommodityStep";

// ─── Platform Setup Store (separate from the regular setup store) ─────────

interface PlatformSetupState {
  step: number;
  orgName: string;
  baseCurrency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  profileId: string | null;
  profile: CustomerProfile | null;
  hierarchyLevels: HierarchyTemplateLevel[];
  selectedCommodities: string[];
  creating: boolean;
  error: string | null;
  createdOrgId: string | null;
  createdUserEmail: string | null;

  setStep: (step: number) => void;
  setOrgInfo: (info: { orgName: string; baseCurrency: string; adminName: string; adminEmail: string; adminPassword: string }) => void;
  setProfile: (profileId: string, profile: CustomerProfile) => void;
  setHierarchy: (levels: HierarchyTemplateLevel[]) => void;
  setCommodities: (ids: string[]) => void;
  createOrganization: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

const initialState = {
  step: 1,
  orgName: "",
  baseCurrency: "USD",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  profileId: null as string | null,
  profile: null as CustomerProfile | null,
  hierarchyLevels: [] as HierarchyTemplateLevel[],
  selectedCommodities: [] as string[],
  creating: false,
  error: null as string | null,
  createdOrgId: null as string | null,
  createdUserEmail: null as string | null,
};

export const usePlatformSetupStore = create<PlatformSetupState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setOrgInfo: (info) => set(info),

  setProfile: (profileId, profile) => {
    const template: HierarchyTemplateLevel[] =
      typeof profile.hierarchy_template === "string"
        ? JSON.parse(profile.hierarchy_template)
        : profile.hierarchy_template;
    set({ profileId, profile, hierarchyLevels: template });
  },

  setHierarchy: (levels) => set({ hierarchyLevels: levels }),
  setCommodities: (ids) => set({ selectedCommodities: ids }),

  createOrganization: async () => {
    const state = get();
    if (!state.profileId) return;

    set({ creating: true, error: null });
    try {
      const payload: CreateOrganizationRequest = {
        orgName: state.orgName,
        baseCurrency: state.baseCurrency,
        adminName: state.adminName,
        adminEmail: state.adminEmail,
        adminPassword: state.adminPassword,
        profileId: state.profileId,
        hierarchyLevels: state.hierarchyLevels,
        selectedCommodities: state.selectedCommodities,
      };

      const res = await fetch(`${API_BASE}/api/platform/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }

      const data: CreateOrganizationResponse = await res.json();
      set({ createdOrgId: data.org.id, createdUserEmail: data.user.email, creating: false, step: 6 });
    } catch (err) {
      set({ error: (err as Error).message, creating: false });
    }
  },

  reset: () => set({ ...initialState }),
  clearError: () => set({ error: null }),
}));

// ─── Platform Review Step ────────────────────────────────────────────────

function PlatformReviewStep() {
  const store = usePlatformSetupStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Review & Create</h2>
        <p className="text-sm text-muted mt-1">Confirm the organization details before creating.</p>
      </div>

      {store.error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss flex items-center justify-between">
          {store.error}
          <button onClick={store.clearError} className="ml-2 underline text-xs">dismiss</button>
        </div>
      )}

      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Organization</p>
            <p className="text-secondary font-medium mt-1">{store.orgName}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Base Currency</p>
            <p className="text-secondary font-medium mt-1">{store.baseCurrency}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Administrator</p>
            <p className="text-secondary font-medium mt-1">{store.adminName} ({store.adminEmail})</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Profile</p>
            <p className="text-secondary font-medium mt-1">{store.profile?.display_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Hierarchy</p>
            <p className="text-secondary font-medium mt-1">
              {store.hierarchyLevels.map((l) => l.label).join(" → ")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Commodities</p>
            <p className="text-secondary font-medium mt-1">{store.selectedCommodities.length} selected</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => store.setStep(4)}
          className="inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input"
        >
          Back
        </button>
        <button
          onClick={store.createOrganization}
          disabled={store.creating}
          className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
        >
          {store.creating ? "Creating..." : "Create Organization"}
        </button>
      </div>
    </div>
  );
}

// ─── Platform Completion Step ────────────────────────────────────────────

function PlatformCompletionStep() {
  const router = useRouter();
  const { createdOrgId, createdUserEmail, adminEmail, reset } = usePlatformSetupStore();

  function goToOrg() {
    if (createdOrgId) {
      router.push(`/platform/orgs/${createdOrgId}`);
    }
    reset();
  }

  function goToList() {
    router.push("/platform");
    reset();
  }

  const loginEmail = createdUserEmail || adminEmail;
  const emailChanged = createdUserEmail && createdUserEmail !== adminEmail;

  return (
    <div className="flex flex-col items-center py-12 text-center space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-profit-20">
        <svg className="h-8 w-8 text-profit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-primary">Organization Created</h2>
        <p className="text-sm text-muted mt-1">The new organization is ready to use.</p>
      </div>
      <div className="rounded-lg bg-input-bg border border-b-input p-4 text-left w-full max-w-sm space-y-2">
        <p className="text-xs text-muted uppercase tracking-wider">Admin Login Credentials</p>
        <div className="flex justify-between">
          <span className="text-sm text-muted">Email</span>
          <span className="text-sm text-primary font-mono">{loginEmail}</span>
        </div>
        {emailChanged && (
          <p className="text-xs text-warning">
            Email was adjusted to avoid a duplicate. Use the email above to log in.
          </p>
        )}
        <p className="text-xs text-muted mt-2">Password is the one you entered during setup.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={goToList} className="inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input">
          Back to List
        </button>
        <button onClick={goToOrg} className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors">
          Manage Organization
        </button>
      </div>
    </div>
  );
}

// ─── Store Sync Hook ────────────────────────────────────────────────────

/**
 * Bidirectional sync between the platform setup store and the regular setup store.
 * The existing step components (OrgInfoStep, ProfileStep, etc.) read/write to
 * useSetupStore. We sync so they work seamlessly from the platform wizard.
 */
function useStoreSync() {
  const ps = usePlatformSetupStore();

  // Platform → Setup: push platform state into the setup store
  useEffect(() => {
    useSetupStore.setState({
      step: ps.step,
      orgName: ps.orgName,
      baseCurrency: ps.baseCurrency,
      adminName: ps.adminName,
      adminEmail: ps.adminEmail,
      adminPassword: ps.adminPassword,
      profileId: ps.profileId,
      profile: ps.profile,
      hierarchyLevels: ps.hierarchyLevels,
      selectedCommodities: ps.selectedCommodities,
      creating: ps.creating,
      error: ps.error,
      createdOrgId: ps.createdOrgId,
      createdUserEmail: ps.createdUserEmail,
    });
  }, [ps.step, ps.orgName, ps.baseCurrency, ps.adminName, ps.adminEmail, ps.adminPassword,
      ps.profileId, ps.profile, ps.hierarchyLevels, ps.selectedCommodities,
      ps.creating, ps.error, ps.createdOrgId, ps.createdUserEmail]);

  // Setup → Platform: subscribe to changes made by the step components
  useEffect(() => {
    const unsub = useSetupStore.subscribe((state) => {
      const current = usePlatformSetupStore.getState();
      const patch: Partial<PlatformSetupState> = {};
      if (state.step !== current.step) patch.step = state.step;
      if (state.orgName !== current.orgName) patch.orgName = state.orgName;
      if (state.baseCurrency !== current.baseCurrency) patch.baseCurrency = state.baseCurrency;
      if (state.adminName !== current.adminName) patch.adminName = state.adminName;
      if (state.adminEmail !== current.adminEmail) patch.adminEmail = state.adminEmail;
      if (state.adminPassword !== current.adminPassword) patch.adminPassword = state.adminPassword;
      if (state.profileId !== current.profileId) {
        patch.profileId = state.profileId;
        patch.profile = state.profile;
      }
      if (JSON.stringify(state.hierarchyLevels) !== JSON.stringify(current.hierarchyLevels)) {
        patch.hierarchyLevels = state.hierarchyLevels;
      }
      if (JSON.stringify(state.selectedCommodities) !== JSON.stringify(current.selectedCommodities)) {
        patch.selectedCommodities = state.selectedCommodities;
      }
      if (Object.keys(patch).length > 0) {
        usePlatformSetupStore.setState(patch);
      }
    });
    return unsub;
  }, []);
}

// ─── Main Wizard Component ──────────────────────────────────────────────

export function PlatformSetupWizard() {
  const store = usePlatformSetupStore();

  // Reset on mount
  useEffect(() => {
    usePlatformSetupStore.getState().reset();
    useSetupStore.setState({ step: 1 });
  }, []);

  // Bidirectional sync
  useStoreSync();

  return (
    <div>
      {store.step <= 5 && <StepIndicator current={store.step} />}
      <div className="min-h-[400px]">
        {store.step === 1 && <OrgInfoStep />}
        {store.step === 2 && <ProfileStep />}
        {store.step === 3 && <HierarchyStep />}
        {store.step === 4 && <CommodityStep />}
        {store.step === 5 && <PlatformReviewStep />}
        {store.step === 6 && <PlatformCompletionStep />}
      </div>
    </div>
  );
}
