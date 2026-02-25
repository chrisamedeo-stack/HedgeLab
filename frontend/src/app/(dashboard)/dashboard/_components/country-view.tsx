"use client";

import { CoverageResponse, CornPositionResponse, PhysicalContractResponse, CornBudgetLineResponse } from "@/hooks/useCorn";
import { aggregateCoverage, filterCoverageBySites, getSiteCodesForCountry, SiteWithCountry } from "@/lib/dashboard-aggregation";
import { KpiRow } from "./kpi-row";
import { SiteSummaryTable } from "./site-summary-table";
import { CoverageWaterfallChart } from "./coverage-waterfall-chart";
import { AlertsPanel } from "./alerts-panel";

interface CountryViewProps {
  country: string;
  coverage: CoverageResponse[];
  positions: CornPositionResponse | undefined;
  contracts: PhysicalContractResponse[];
  sites: SiteWithCountry[];
  budget: CornBudgetLineResponse[];
  onSelectSite: (siteCode: string) => void;
}

export function CountryView({
  country,
  coverage,
  positions,
  contracts,
  sites,
  budget,
  onSelectSite,
}: CountryViewProps) {
  const siteCodes = getSiteCodesForCountry(sites, country);
  const countryCoverage = filterCoverageBySites(coverage, siteCodes);
  const agg = aggregateCoverage(countryCoverage);

  const countryContracts = contracts.filter((c) => siteCodes.includes(c.siteCode));
  const activeContracts = countryContracts.filter(
    (c) => c.status !== "CANCELLED" && c.status !== "CLOSED"
  ).length;

  return (
    <div className="space-y-6">
      <KpiRow
        cards={[
          { label: "Budget", value: agg.budgetBu, unit: "bu" },
          { label: "Hedge Coverage", value: agg.coveragePct, unit: "pct" },
          { label: "Open Hedge Lots", value: agg.openHedgeLots, unit: "count" },
          { label: "Active Contracts", value: activeContracts, unit: "count" },
        ]}
      />

      <SiteSummaryTable coverage={countryCoverage} onSelectSite={onSelectSite} />

      <CoverageWaterfallChart coverage={coverage} filterSiteCodes={siteCodes} />

      <AlertsPanel coverage={coverage} positions={positions} contracts={contracts} filterSiteCodes={siteCodes} />
    </div>
  );
}
