import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  MarketPrice,
  CreatePriceParams,
  PriceFilters,
  PriceBoardRow,
  UploadPreview,
  IngestResultClient,
} from "@/types/market";

interface ForwardCurveData {
  current: { contract_month: string; price: number }[];
  comparison: { contract_month: string; price: number }[] | null;
  compareDate: string | null;
}

interface MarketState {
  prices: MarketPrice[];
  latestPrices: MarketPrice[];
  forwardCurve: ForwardCurveData | null;
  priceBoard: PriceBoardRow[];
  uploadPreview: UploadPreview | null;
  uploading: boolean;
  loading: boolean;
  error: string | null;

  fetchPrices: (filters?: PriceFilters) => Promise<void>;
  fetchLatestPrices: (commodityId: string) => Promise<void>;
  fetchForwardCurve: (orgId: string, commodityId: string, compareDate?: string) => Promise<void>;
  createPrices: (params: CreatePriceParams[]) => Promise<MarketPrice[]>;
  fetchPriceBoard: (commodityId?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  commitUpload: (rows: UploadPreview["rows"]) => Promise<IngestResultClient>;
  clearUpload: () => void;
  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useMarketStore = create<MarketState>((set, get) => ({
  prices: [],
  latestPrices: [],
  forwardCurve: null,
  priceBoard: [],
  uploadPreview: null,
  uploading: false,
  loading: false,
  error: null,

  fetchPrices: async (filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/market/prices${qs({
        commodityId: filters?.commodityId,
        contractMonth: filters?.contractMonth,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        priceType: filters?.priceType,
      })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const prices = await res.json();
      set({ prices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchLatestPrices: async (commodityId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/market/prices/latest?commodityId=${commodityId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const latestPrices = await res.json();
      set({ latestPrices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchForwardCurve: async (orgId, commodityId, compareDate) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/market/curves/compare${qs({
        orgId,
        commodityId,
        compareDate,
      })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const forwardCurve = await res.json();
      set({ forwardCurve, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createPrices: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/market/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      const created = Array.isArray(result) ? result : [result];
      set((s) => ({ prices: [...created, ...s.prices], loading: false }));
      return created;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  fetchPriceBoard: async (commodityId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/market/prices/board${qs({ commodityId })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const priceBoard = await res.json();
      set({ priceBoard, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  uploadFile: async (file) => {
    set({ uploading: true, error: null, uploadPreview: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/market/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const preview = await res.json();
      set({ uploadPreview: preview, uploading: false });
    } catch (err) {
      set({ error: (err as Error).message, uploading: false });
    }
  },

  commitUpload: async (rows) => {
    const preview = get().uploadPreview;
    if (!preview) throw new Error("No upload to commit");
    set({ uploading: true, error: null });
    try {
      const validRows = rows.filter((r) => r.status === "valid");
      const res = await fetch(`${API_BASE}/api/market/upload`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result: IngestResultClient = await res.json();
      set({ uploading: false, uploadPreview: null });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, uploading: false });
      throw err;
    }
  },

  clearUpload: () => set({ uploadPreview: null }),
  clearError: () => set({ error: null }),
}));
