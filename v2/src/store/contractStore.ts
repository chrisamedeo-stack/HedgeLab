import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  PhysicalContract,
  CreateContractParams,
  UpdateContractParams,
  ContractFilters,
  Counterparty,
  CreateCounterpartyParams,
  UpdateCounterpartyParams,
} from "@/types/contracts";

interface ContractState {
  // Data
  contracts: PhysicalContract[];
  counterparties: Counterparty[];

  // UI state
  loading: boolean;
  error: string | null;

  // Contract actions
  fetchContracts: (orgId: string, filters?: Partial<ContractFilters>) => Promise<void>;
  createContract: (params: CreateContractParams) => Promise<PhysicalContract>;
  createBulkContracts: (paramsList: CreateContractParams[]) => Promise<PhysicalContract[]>;
  updateContract: (id: string, userId: string, changes: UpdateContractParams) => Promise<PhysicalContract>;
  transitionContract: (id: string, userId: string, action: string, extra?: Record<string, unknown>) => Promise<PhysicalContract>;
  cancelContract: (id: string, userId: string, reason?: string) => Promise<void>;

  // Counterparty actions
  fetchCounterparties: (orgId: string) => Promise<void>;
  createCounterparty: (params: CreateCounterpartyParams) => Promise<Counterparty>;
  updateCounterparty: (id: string, userId: string, changes: UpdateCounterpartyParams) => Promise<Counterparty>;

  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useContractStore = create<ContractState>((set) => ({
  contracts: [],
  counterparties: [],
  loading: false,
  error: null,

  fetchContracts: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts${qs({ orgId, ...filters })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const contracts = await res.json();
      set({ contracts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createContract: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const contract = await res.json();
      set((s) => ({ contracts: [contract, ...s.contracts], loading: false }));
      return contract;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  createBulkContracts: async (paramsList) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paramsList),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const contracts: PhysicalContract[] = await res.json();
      set((s) => ({ contracts: [...contracts, ...s.contracts], loading: false }));
      return contracts;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateContract: async (id, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        contracts: s.contracts.map((c) => (c.id === id ? updated : c)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  transitionContract: async (id, userId, action, extra) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        contracts: s.contracts.map((c) => (c.id === id ? updated : c)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  cancelContract: async (id, userId, reason) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `${API_BASE}/api/contracts/${id}?userId=${userId}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const cancelled = await res.json();
      set((s) => ({
        contracts: s.contracts.map((c) => (c.id === id ? cancelled : c)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchCounterparties: async (orgId) => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts/counterparties?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const counterparties = await res.json();
      set({ counterparties });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createCounterparty: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts/counterparties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const cp = await res.json();
      set((s) => ({ counterparties: [cp, ...s.counterparties], loading: false }));
      return cp;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateCounterparty: async (id, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/contracts/counterparties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        counterparties: s.counterparties.map((c) => (c.id === id ? updated : c)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
