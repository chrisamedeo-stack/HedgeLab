import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type { OrgSummary, OrgDetail, PlatformStats } from "@/types/platform";

interface PlatformState {
  orgs: OrgSummary[];
  selectedOrg: OrgDetail | null;
  stats: PlatformStats | null;
  loading: boolean;
  error: string | null;

  fetchOrgs: () => Promise<void>;
  fetchOrg: (orgId: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  updateOrg: (orgId: string, patch: Record<string, unknown>) => Promise<void>;
  deactivateOrg: (orgId: string) => Promise<void>;
  hardDeleteOrg: (orgId: string) => Promise<void>;
  togglePlugin: (orgId: string, pluginId: string, enabled: boolean) => Promise<void>;
  clearError: () => void;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  orgs: [],
  selectedOrg: null,
  stats: null,
  loading: false,
  error: null,

  fetchOrgs: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations`);
      if (!res.ok) throw new Error("Failed to load organizations");
      const orgs = await res.json();
      set({ orgs, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchOrg: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations/${orgId}`);
      if (!res.ok) throw new Error("Failed to load organization");
      const org = await res.json();
      set({ selectedOrg: org, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations`);
      if (!res.ok) return;
      const orgs: OrgSummary[] = await res.json();
      set({
        stats: {
          total_orgs: orgs.length,
          active_orgs: orgs.filter(o => o.is_active).length,
          total_users: orgs.reduce((sum, o) => sum + o.user_count, 0),
          total_sites: orgs.reduce((sum, o) => sum + o.site_count, 0),
        },
      });
    } catch {
      // Stats are non-critical
    }
  },

  updateOrg: async (orgId: string, patch: Record<string, unknown>) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update organization");
      const updated = await res.json();
      set({ selectedOrg: updated, loading: false });
      get().fetchOrgs();
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deactivateOrg: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations/${orgId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to deactivate organization");
      set({ selectedOrg: null, loading: false });
      get().fetchOrgs();
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  hardDeleteOrg: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations/${orgId}?hard=true`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete organization");
      set({ selectedOrg: null, loading: false });
      get().fetchOrgs();
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  togglePlugin: async (orgId: string, pluginId: string, enabled: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/platform/organizations/${orgId}/plugins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle plugin");
      get().fetchOrg(orgId);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
