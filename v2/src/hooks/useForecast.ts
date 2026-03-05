"use client";

import { useEffect } from "react";
import { useForecastStore } from "@/store/forecastStore";
import type { ScenarioFilters } from "@/types/forecast";

export function useScenarios(orgId: string, filters?: ScenarioFilters) {
  const { scenarios, loading, error, fetchScenarios } = useForecastStore();

  useEffect(() => {
    if (orgId) fetchScenarios(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchScenarios]);

  return {
    data: scenarios,
    loading,
    error,
    refetch: () => fetchScenarios(orgId, filters),
  };
}

export function useScenario(scenarioId: string | null) {
  const { activeScenario, activeResults, loading, error, fetchScenario } = useForecastStore();

  useEffect(() => {
    if (scenarioId) fetchScenario(scenarioId);
  }, [scenarioId, fetchScenario]);

  return {
    data: activeScenario,
    results: activeResults,
    loading,
    error,
    refetch: () => (scenarioId ? fetchScenario(scenarioId) : undefined),
  };
}
