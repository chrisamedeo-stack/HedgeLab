"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CommodityContextValue {
  commodityId: string | null;
  setCommodityId: (id: string | null) => void;
}

const CommodityContext = createContext<CommodityContextValue | null>(null);

const STORAGE_KEY = "hedgelab-commodity-id";

export function CommodityProvider({ children }: { children: ReactNode }) {
  const [commodityId, setCommodityIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCommodityIdState(stored);
    setLoaded(true);
  }, []);

  function setCommodityId(id: string | null) {
    setCommodityIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  if (!loaded) return null;

  return (
    <CommodityContext.Provider value={{ commodityId, setCommodityId }}>
      {children}
    </CommodityContext.Provider>
  );
}

export function useCommodityContext() {
  const ctx = useContext(CommodityContext);
  if (!ctx) throw new Error("useCommodityContext must be used within CommodityProvider");
  return ctx;
}
