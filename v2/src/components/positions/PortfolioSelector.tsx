"use client";

import { useEffect, useState } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";
import type { Portfolio } from "@/types/pm";

interface PortfolioSelectorProps {
  value: string | null;
  onChange: (portfolioId: string | null) => void;
  commodity?: string;
}

export function PortfolioSelector({ value, onChange, commodity }: PortfolioSelectorProps) {
  const { orgId } = useOrgContext();
  const multiPortfolio = useFeatureFlag("multi_portfolio");
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

  useEffect(() => {
    if (!orgId || !multiPortfolio) return;
    fetch(`/api/pm/portfolios?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => setPortfolios(data))
      .catch((err) => console.error("[PortfolioSelector] fetch error:", err));
  }, [orgId, multiPortfolio]);

  if (!multiPortfolio) return null;

  // Filter by commodity if specified
  const filtered = commodity
    ? portfolios.filter((p) => !p.commodity || p.commodity === commodity)
    : portfolios;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-b-input bg-input-bg px-2 py-1 text-sm text-primary focus:border-focus focus:outline-none"
    >
      <option value="">All Portfolios</option>
      {filtered.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
