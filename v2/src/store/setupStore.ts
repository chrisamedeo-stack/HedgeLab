import { create } from "zustand";
import type { CustomerProfile, HierarchyTemplateLevel } from "@/types/org";
import type { CreateOrganizationRequest, CreateOrganizationResponse, CheckOrgResponse } from "@/types/setup";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetupState {
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

  // Actions
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

export const useSetupStore = create<SetupState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setOrgInfo: (info) => set(info),

  setProfile: (profileId, profile) => {
    // Auto-populate hierarchy levels from profile template
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

      const res = await fetch("/api/kernel/organizations", {
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

/** Check if an organization already exists */
export async function checkOrgExists(): Promise<CheckOrgResponse> {
  const res = await fetch("/api/kernel/organizations");
  return res.json();
}
