import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type { HedgeBook, HedgeBookSummary, Position, PipelineTab } from "@/types/positions";

interface HedgeBookState {
  // Data
  books: HedgeBook[];
  activeBookId: string | null;
  positions: Position[];
  summary: HedgeBookSummary | null;
  activeTab: PipelineTab;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  fetchBooks: (orgId: string) => Promise<void>;
  setActiveBook: (bookId: string | null) => void;
  setActiveTab: (tab: PipelineTab) => void;
  fetchPositions: (bookId: string, tab?: PipelineTab) => Promise<void>;
  fetchSummary: (bookId: string) => Promise<void>;

  // Mutations (call action endpoints, then refetch)
  allocatePosition: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  executeEFP: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  executeOffset: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  exerciseOption: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  expireOption: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  splitPosition: (positionId: string, params: Record<string, unknown>) => Promise<void>;
  reassignBook: (positionId: string, params: Record<string, unknown>) => Promise<void>;

  // Book CRUD
  createBook: (params: Record<string, unknown>) => Promise<HedgeBook>;
  updateBook: (bookId: string, params: Record<string, unknown>) => Promise<HedgeBook>;
  deactivateBook: (bookId: string) => Promise<void>;

  clearError: () => void;
}

const PM_BASE = `${API_BASE}/api/v1/position-manager`;

async function apiPost(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const useHedgeBookStore = create<HedgeBookState>((set, get) => ({
  books: [],
  activeBookId: null,
  positions: [],
  summary: null,
  activeTab: "delivery",
  loading: false,
  error: null,

  fetchBooks: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${PM_BASE}/books?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const books = await res.json();
      set({ books, loading: false });
      // Auto-select first book if none selected
      if (!get().activeBookId && books.length > 0) {
        set({ activeBookId: books[0].id });
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setActiveBook: (bookId) => set({ activeBookId: bookId }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchPositions: async (bookId, tab) => {
    set({ loading: true, error: null });
    try {
      const t = tab ?? get().activeTab;
      const res = await fetch(`${PM_BASE}/books/${bookId}/positions?tab=${t}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const positions = await res.json();
      set({ positions, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchSummary: async (bookId) => {
    try {
      const res = await fetch(`${PM_BASE}/books/${bookId}/summary`);
      if (!res.ok) throw new Error((await res.json()).error);
      const summary = await res.json();
      set({ summary });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  // ─── Mutation helpers ───────────────────────────────────────────────
  allocatePosition: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/allocate`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  executeEFP: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/efp`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  executeOffset: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/offset`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  exerciseOption: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/exercise`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  expireOption: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/expire`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  splitPosition: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/split`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  reassignBook: async (positionId, params) => {
    set({ loading: true, error: null });
    try {
      await apiPost(`${PM_BASE}/positions/${positionId}/reassign-book`, params);
      const bookId = get().activeBookId;
      if (bookId) { await get().fetchPositions(bookId); await get().fetchSummary(bookId); }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  // ─── Book CRUD ──────────────────────────────────────────────────────
  createBook: async (params) => {
    const res = await fetch(`${PM_BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const book = await res.json();
    set((s) => ({ books: [...s.books, book] }));
    return book;
  },

  updateBook: async (bookId, params) => {
    const res = await fetch(`${PM_BASE}/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const book = await res.json();
    set((s) => ({ books: s.books.map((b) => (b.id === bookId ? book : b)) }));
    return book;
  },

  deactivateBook: async (bookId) => {
    const res = await fetch(`${PM_BASE}/books/${bookId}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error);
    set((s) => ({ books: s.books.map((b) => (b.id === bookId ? { ...b, is_active: false } : b)) }));
  },

  clearError: () => set({ error: null }),
}));
