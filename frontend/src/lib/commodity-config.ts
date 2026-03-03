// ─── Commodity Configuration ─────────────────────────────────────────────────

export interface CommodityConfig {
  code: string;          // e.g. "CORN", "SOYBEAN"
  slug: string;          // URL slug e.g. "corn", "soybeans"
  label: string;         // Display name e.g. "Corn", "Soybeans"
  exchange: string;      // e.g. "CBOT"
  futuresPrefix: string; // e.g. "ZC", "ZS"
  contractSizeBu: number;// e.g. 5000
  bushelsPerMt: number;  // e.g. 39.3683
  contractMonths: string[];  // e.g. ["H","K","N","U","Z"]
  monthMappings: Record<string, number[]>; // e.g. { H: [12,1,2], K: [3,4], ... }
}

export const COMMODITIES: Record<string, CommodityConfig> = {
  corn: {
    code: "CORN",
    slug: "corn",
    label: "Corn",
    exchange: "CBOT",
    futuresPrefix: "ZC",
    contractSizeBu: 5000,
    bushelsPerMt: 39.3683,
    contractMonths: ["H", "K", "N", "U", "Z"],
    monthMappings: {
      H: [12, 1, 2],
      K: [3, 4],
      N: [5, 6],
      U: [7, 8],
      Z: [9, 10, 11],
    },
  },
  soybeans: {
    code: "SOYBEAN",
    slug: "soybeans",
    label: "Soybeans",
    exchange: "CBOT",
    futuresPrefix: "ZS",
    contractSizeBu: 5000,
    bushelsPerMt: 36.7437,
    contractMonths: ["F", "H", "K", "N", "Q", "U", "X"],
    monthMappings: {
      F: [11, 12, 1],
      H: [2, 3],
      K: [4, 5],
      N: [6, 7],
      Q: [8],
      U: [9],
      X: [10, 11],
    },
  },
};

/** All valid commodity slugs */
export const COMMODITY_SLUGS = Object.keys(COMMODITIES);

/** Look up config by slug (throws if not found) */
export function getCommodityConfig(slug: string): CommodityConfig {
  const config = COMMODITIES[slug.toLowerCase()];
  if (!config) throw new Error(`Unknown commodity: ${slug}`);
  return config;
}

/** Check if a slug is a valid commodity */
export function isValidCommoditySlug(slug: string): boolean {
  return slug.toLowerCase() in COMMODITIES;
}
