import { CoverageResponse, HedgeBookItem, CornBudgetLineResponse } from "@/hooks/useCorn";

/** Minimal site shape needed for dashboard grouping — both SiteResponse types satisfy this */
export interface SiteWithCountry {
  code: string;
  name: string;
  country: string;
}

const BUSHELS_PER_MT = 39.3683;

/** Group coverage entries by country using site lookup */
export function groupCoverageByCountry(
  coverage: CoverageResponse[],
  sites: SiteWithCountry[]
): Map<string, CoverageResponse[]> {
  const siteCountry = new Map<string, string>();
  for (const s of sites) siteCountry.set(s.code, s.country);

  const groups = new Map<string, CoverageResponse[]>();
  for (const c of coverage) {
    const country = siteCountry.get(c.siteCode) ?? "Unknown";
    const list = groups.get(country) ?? [];
    list.push(c);
    groups.set(country, list);
  }
  return groups;
}

/** Aggregate coverage totals across a set of coverage entries */
export function aggregateCoverage(entries: CoverageResponse[]) {
  const totals = entries.reduce(
    (acc, c) => ({
      budgetedMt: acc.budgetedMt + (c.budgetedMt ?? 0),
      hedgedMt: acc.hedgedMt + (c.hedgedMt ?? 0),
      committedMt: acc.committedMt + (c.committedMt ?? 0),
      efpdMt: acc.efpdMt + (c.efpdMt ?? 0),
      receivedMt: acc.receivedMt + (c.receivedMt ?? 0),
      openHedgeLots: acc.openHedgeLots + (c.openHedgeLots ?? 0),
    }),
    { budgetedMt: 0, hedgedMt: 0, committedMt: 0, efpdMt: 0, receivedMt: 0, openHedgeLots: 0 }
  );

  const budgetBu = totals.budgetedMt * BUSHELS_PER_MT;
  const hedgedBu = totals.hedgedMt * BUSHELS_PER_MT;
  const coveragePct = totals.budgetedMt > 0 ? (totals.hedgedMt / totals.budgetedMt) * 100 : 0;

  return { ...totals, budgetBu, hedgedBu, coveragePct };
}

/** Sum MTM P&L across hedge book entries, optionally filtered by site codes */
export function aggregateMtm(
  hedgeBook: HedgeBookItem[] | undefined,
  filterSiteCodes?: string[]
): number {
  if (!hedgeBook) return 0;
  // HedgeBookItem is at trade level (not site-specific), so we sum all
  // If we need site-level filtering, we'd need siteAllocations — but for portfolio level, sum all
  return hedgeBook.reduce((s, h) => s + (h.mtmPnlUsd ?? 0), 0);
}

/** Get site codes for a given country */
export function getSiteCodesForCountry(
  sites: SiteWithCountry[],
  country: string
): string[] {
  return sites.filter((s) => s.country === country).map((s) => s.code);
}

/** Filter coverage entries to specific site codes */
export function filterCoverageBySites(
  coverage: CoverageResponse[],
  siteCodes: string[]
): CoverageResponse[] {
  const set = new Set(siteCodes);
  return coverage.filter((c) => set.has(c.siteCode));
}

/** Filter budget lines to specific site codes */
export function filterBudgetBySites(
  budget: CornBudgetLineResponse[],
  siteCodes: string[]
): CornBudgetLineResponse[] {
  const set = new Set(siteCodes);
  return budget.filter((b) => set.has(b.siteCode));
}
