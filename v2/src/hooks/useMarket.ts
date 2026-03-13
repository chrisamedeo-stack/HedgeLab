"use client";

import { useEffect, useCallback } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { PriceFilters } from "@/types/market";

// ─── Price List ─────────────────────────────────────────────────────────────

export function usePrices(filters?: PriceFilters) {
  const { prices, loading, error, fetchPrices } = useMarketStore();

  useEffect(() => {
    fetchPrices(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), fetchPrices]);

  return {
    data: prices,
    loading,
    error,
    refetch: () => fetchPrices(filters),
  };
}

// ─── Latest Prices (for open board integration) ─────────────────────────────

export function useLatestPrices(commodityId?: string) {
  const { latestPrices, loading, error, fetchLatestPrices } = useMarketStore();

  useEffect(() => {
    if (commodityId) fetchLatestPrices(commodityId);
  }, [commodityId, fetchLatestPrices]);

  return {
    data: latestPrices,
    loading,
    error,
    refetch: () => commodityId ? fetchLatestPrices(commodityId) : undefined,
  };
}

// ─── Forward Curve Comparison ────────────────────────────────────────────────

export function useForwardCurve(orgId: string, commodityId?: string, compareDate?: string) {
  const { forwardCurve, loading, error, fetchForwardCurve } = useMarketStore();

  useEffect(() => {
    if (orgId && commodityId) fetchForwardCurve(orgId, commodityId, compareDate);
  }, [orgId, commodityId, compareDate, fetchForwardCurve]);

  return {
    data: forwardCurve,
    loading,
    error,
    refetch: () => commodityId ? fetchForwardCurve(orgId, commodityId, compareDate) : undefined,
  };
}

// ─── Price Board ────────────────────────────────────────────────────────────

export function usePriceBoard(commodityId?: string) {
  const { priceBoard, loading, error, fetchPriceBoard } = useMarketStore();

  useEffect(() => {
    fetchPriceBoard(commodityId);
  }, [commodityId, fetchPriceBoard]);

  return {
    data: priceBoard,
    loading,
    error,
    refetch: () => fetchPriceBoard(commodityId),
  };
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export function useUpload() {
  const { uploadPreview, uploading, error, uploadFile, commitUpload, clearUpload } = useMarketStore();

  const handleFileSelect = useCallback((file: File) => {
    uploadFile(file);
  }, [uploadFile]);

  const handleCommit = useCallback(async () => {
    if (!uploadPreview) return null;
    return commitUpload(uploadPreview.rows);
  }, [uploadPreview, commitUpload]);

  return {
    preview: uploadPreview,
    uploading,
    error,
    handleFileSelect,
    handleCommit,
    clearUpload,
  };
}

// ─── Re-export store for direct access ──────────────────────────────────────

export { useMarketStore } from "@/store/marketStore";
