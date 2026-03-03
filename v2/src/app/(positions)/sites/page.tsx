"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSites, useSiteGroups } from "@/hooks/usePositions";
import { RegionTabs } from "@/components/ui/RegionTabs";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function SitesIndexPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const { data: sites, loading } = useSites(ORG_ID);
  const { data: regions } = useSiteGroups(ORG_ID, "region");

  const regionTabs = useMemo(() =>
    (regions ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      siteCount: r.sites.length,
    })),
    [regions]
  );

  // Filter sites by selected region
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedRegion || !regions) return sites;
    const region = regions.find((r) => r.id === selectedRegion);
    if (!region) return sites;
    const siteIds = new Set(region.sites.map((s) => s.id));
    return sites.filter((s) => siteIds.has(s.id));
  }, [sites, selectedRegion, regions]);

  // Group by region
  const grouped = useMemo(() => {
    const map: Record<string, typeof filteredSites> = {};
    for (const site of filteredSites) {
      const region = site.region || "Other";
      if (!map[region]) map[region] = [];
      map[region].push(site);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSites]);

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Sites</h1>
        <p className="mt-0.5 text-xs text-faint">Operating locations grouped by region</p>
      </div>

      <RegionTabs
        regions={regionTabs}
        selected={selectedRegion}
        onSelect={setSelectedRegion}
      />

      {loading ? (
        <div className="py-12 text-center text-faint">Loading sites...</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([region, regionSites]) => (
            <div key={region}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-faint">
                {region}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {regionSites.map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}`}
                    className="group rounded-lg border border-b-default bg-surface p-4 transition-colors hover:border-b-input hover:bg-hover"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-secondary group-hover:text-primary">
                          {site.name}
                        </div>
                        <div className="mt-0.5 text-xs text-faint">{site.code}</div>
                      </div>
                      <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">
                        {site.site_type_name}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-faint">
                      {site.operating_model} model
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="py-12 text-center text-faint">No sites found.</div>
          )}
        </div>
      )}
    </div>
  );
}
