import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  Invoice,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  InvoiceFilters,
} from "@/types/settlement";

interface SettlementState {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;

  fetchInvoices: (orgId: string, filters?: Partial<InvoiceFilters>) => Promise<void>;
  createInvoice: (params: CreateInvoiceParams) => Promise<Invoice>;
  updateInvoice: (id: string, userId: string, changes: UpdateInvoiceParams) => Promise<Invoice>;
  issueInvoice: (id: string, userId: string) => Promise<Invoice>;
  recordPayment: (id: string, userId: string, paymentDate: string, paymentRef?: string) => Promise<Invoice>;
  cancelInvoice: (id: string, userId: string) => Promise<void>;
  generateFromDeliveries: (orgId: string, userId: string, deliveryIds: string[], invoiceType: string, counterpartyId?: string, counterpartyName?: string) => Promise<Invoice>;
  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useSettlementStore = create<SettlementState>((set) => ({
  invoices: [],
  loading: false,
  error: null,

  fetchInvoices: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices${qs({ orgId, ...filters })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const invoices = await res.json();
      set({ invoices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createInvoice: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const invoice = await res.json();
      set((s) => ({ invoices: [invoice, ...s.invoices], loading: false }));
      return invoice;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateInvoice: async (id, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? updated : i)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  issueInvoice: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "issue" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const issued = await res.json();
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? issued : i)),
        loading: false,
      }));
      return issued;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  recordPayment: async (id, userId, paymentDate, paymentRef) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paymentDate, paymentRef }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const paid = await res.json();
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? paid : i)),
        loading: false,
      }));
      return paid;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  cancelInvoice: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `${API_BASE}/api/settlement/invoices/${id}?userId=${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const cancelled = await res.json();
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? cancelled : i)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  generateFromDeliveries: async (orgId, userId, deliveryIds, invoiceType, counterpartyId, counterpartyName) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/settlement/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId, deliveryIds, invoiceType, counterpartyId, counterpartyName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const invoice = await res.json();
      set((s) => ({ invoices: [invoice, ...s.invoices], loading: false }));
      return invoice;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
