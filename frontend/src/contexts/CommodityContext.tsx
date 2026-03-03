"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type CommodityConfig, getCommodityConfig } from "@/lib/commodity-config";

interface CommodityContextValue {
  /** The commodity config for the current route */
  config: CommodityConfig;
  /** The URL slug (e.g. "corn", "soybeans") */
  slug: string;
  /** The commodity code (e.g. "CORN", "SOYBEAN") */
  code: string;
  /** API base path (e.g. "/api/v1/corn") */
  apiBase: string;
}

const CommodityContext = createContext<CommodityContextValue | null>(null);

export function CommodityProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const config = getCommodityConfig(slug);
  const value: CommodityContextValue = {
    config,
    slug: config.slug,
    code: config.code,
    apiBase: `/api/v1/${config.slug}`,
  };

  return (
    <CommodityContext.Provider value={value}>
      {children}
    </CommodityContext.Provider>
  );
}

export function useCommodity(): CommodityContextValue {
  const ctx = useContext(CommodityContext);
  if (!ctx) {
    throw new Error("useCommodity must be used within a CommodityProvider");
  }
  return ctx;
}
