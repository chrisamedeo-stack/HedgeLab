"use client";

import { useEffect } from "react";
import { useSettlementStore } from "@/store/settlementStore";
import type { InvoiceFilters } from "@/types/settlement";

export function useInvoices(orgId: string, filters?: Partial<InvoiceFilters>) {
  const { invoices, loading, error, fetchInvoices } = useSettlementStore();

  useEffect(() => {
    if (orgId) fetchInvoices(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchInvoices]);

  return {
    data: invoices,
    loading,
    error,
    refetch: () => fetchInvoices(orgId, filters),
  };
}

export { useSettlementStore } from "@/store/settlementStore";
