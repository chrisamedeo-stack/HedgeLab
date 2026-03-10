"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API_BASE } from "@/lib/api";
import type { Commodity } from "@/hooks/usePositions";

interface CommodityContextValue {
  commodityId: string | null;
  setCommodityId: (id: string | null) => void;
  commodity: Commodity | null;
  commodities: Commodity[];
  loading: boolean;
}

const CommodityContext = createContext<CommodityContextValue | null>(null);

const STORAGE_KEY = "hedgelab-commodity-id";

export function CommodityProvider({ children }: { children: ReactNode }) {
  const [commodityId, setCommodityIdState] = useState<string | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load stored commodity ID from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCommodityIdState(stored);
    setLoaded(true);
  }, []);

  // Fetch commodities from API
  useEffect(() => {
    let cancelled = false;
    async function fetchCommodities() {
      try {
        const res = await fetch(`${API_BASE}/api/v2/kernel/commodities`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCommodities(data);
        }
      } catch {
        // silently fail — components can still function without commodity metadata
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCommodities();
    return () => { cancelled = true; };
  }, []);

  function setCommodityId(id: string | null) {
    setCommodityIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Resolve the full commodity object from the selected ID
  const commodity = commodityId
    ? commodities.find((c) => c.id === commodityId) ?? null
    : null;

  if (!loaded) return null;

  return (
    <CommodityContext.Provider value={{ commodityId, setCommodityId, commodity, commodities, loading }}>
      {children}
    </CommodityContext.Provider>
  );
}

export function useCommodityContext() {
  const ctx = useContext(CommodityContext);
  if (!ctx) throw new Error("useCommodityContext must be used within CommodityProvider");
  return ctx;
}
