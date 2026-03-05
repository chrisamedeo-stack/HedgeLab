"use client";

import { useEffect } from "react";
import { useContractStore } from "@/store/contractStore";
import type { ContractFilters } from "@/types/contracts";

export function useContracts(orgId: string, filters?: Partial<ContractFilters>) {
  const { contracts, loading, error, fetchContracts } = useContractStore();

  useEffect(() => {
    if (orgId) fetchContracts(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchContracts]);

  return {
    data: contracts,
    loading,
    error,
    refetch: () => fetchContracts(orgId, filters),
  };
}

export function useCounterparties(orgId: string) {
  const { counterparties, loading, error, fetchCounterparties } = useContractStore();

  useEffect(() => {
    if (orgId) fetchCounterparties(orgId);
  }, [orgId, fetchCounterparties]);

  return {
    data: counterparties,
    loading,
    error,
    refetch: () => fetchCounterparties(orgId),
  };
}

export { useContractStore } from "@/store/contractStore";
