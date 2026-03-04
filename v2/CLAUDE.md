# HedgeLab v2 — Claude Code Instructions

## READ FIRST
Before doing ANY work, read the master design document:
```
cat docs/HEDGELAB_MASTER_v2.md
```
This is the single source of truth. Every table schema, service function, event, and permission is defined there. Do not deviate from it.

## CRITICAL RULES

### Scalability — Nothing Hardcoded

- **No hardcoded regions, geographies, or country names** in any code. The org hierarchy comes from `org_units` and `org_hierarchy_levels` tables.
- **No hardcoded commodity names** (no "CORN" string literals in UI logic). Commodities come from the `commodities` table.
- **No hardcoded site types.** Site types come from `site_types` table.
- **No hardcoded plugins or features.** Check `org_plugins` before rendering any plugin's UI or processing its API requests. If a plugin isn't enabled for the org, it doesn't exist for that org.
- Every dropdown, tab group, filter, and navigation element that displays regions, commodities, site types, or hierarchy levels must be **data-driven from the database**.
- Navigation sidebar renders the org hierarchy tree dynamically — a multi-national sees corporate → country → region → site, a producer sees just sites. The depth comes from `org_hierarchy_levels`.
- Clicking any non-site node in the hierarchy shows a roll-up dashboard aggregating all sites below it.
- Seed data and customer profiles are starting points. The system must work with zero seed data if an org configures everything themselves.

### Architecture — Kernel + Plugins

- Only the kernel is required. Every plugin is optional.
- **Plugins are enabled per-org via the `org_plugins` table.** Check `isPluginEnabled(orgId, pluginId)` before rendering UI or processing requests.
- **No foreign keys across module boundaries.** Use soft UUID references.
- Every plugin must define fallback behavior when its dependencies are missing.
- Plugins communicate through the event bus (`lib/eventBus.js`), never direct imports.
- Table naming: kernel tables have no prefix. Plugin tables use their prefix (`tc_`, `pm_`, `bgt_`, etc.).
- Org hierarchy (`org_units`, `org_hierarchy_levels`) drives all navigation, grouping, and roll-up aggregation. Never hardcode hierarchy levels.
- Customer profiles (`customer_profiles`) pre-configure new orgs with the right plugins, hierarchy, and settings. All editable after creation.

### Data Integrity
- All financial values: `NUMERIC` type. Never `FLOAT` or `DOUBLE`.
- All timestamps: `TIMESTAMPTZ`. Never `TIMESTAMP`.
- All tables with financial data include a `currency` field.
- Every data mutation calls `auditLog()` with before/after snapshots.
- Every action checks permissions via `checkPermission()`.

### UI
- Dark trading theme. Reference v1 for color scheme and layout patterns.
- Navigation sidebar renders the org hierarchy tree dynamically from `org_units`. Expandable/collapsible nodes. Clicking a non-site node shows a roll-up dashboard. Clicking a site shows the 4-section site view.
- Hedge book groups by the hierarchy level above sites — not hardcoded "region." A multi-national groups by country, a regional company groups by region, a single-site producer shows no grouping.
- The 4-section site view layout (hedges → physical commitments → open board → all-in summary) is the core UX pattern.
- EFP is handled behind the scenes — user clicks "lock", system executes EFP logic invisibly.
- Offset only allowed from site level, never from hedge book.
- Nav items and features are gated by `org_plugins`. If a plugin isn't enabled, its nav links, pages, and API routes don't render or respond.

## BUILD ORDER
Follow this sequence. Do not skip steps.

1. **Kernel** — All kernel tables, helpers, RBAC seeds, audit system, FX, contract calendar, event bus
2. **Position Manager** — pm_ tables, hedge book (data-driven region tabs), site views, EFP, offset, rollover, position chains
3. **AI Import Engine** — Import jobs, staging, templates, Claude API integration, review UI
4. **Trade Capture** — tc_ tables, trade entry, event wiring to PM
5. **Market Data** — md_ tables, price entry, PRICE_UPDATED events
6. **Budget** — bgt_ tables, periods, line items, versions, approval workflow, coverage charts
7. **Formula Pricing** — Pricing formulas, rate tables, evaluation engine, builder UI
8. **Admin UI** — Site wizard, commodity config, user/role management, org settings
9. **Charts & Dashboard** — Chart components, KPI cards, configurable dashboard grid
10. **Contracts + Risk** — Physical contracts, counterparties, MTM engine, position limits
11. **Forecasting** — Scenarios, sensitivity analysis, stress tests
12. **Logistics + Settlement** — Deliveries, inventory, invoicing, payments
13. **Energy** — Energy commodities, load profiles, ISO pricing, energy site type

## V1 REFERENCES
When building Steps 2, 6, and 9, reference the v1 codebase for UI patterns:
- **Step 2 (Position Manager):** Look at v1's hedge book layout, site view sections, EFP/offset flows, allocation split UX. Rebuild with new schemas but keep the look and feel.
- **Step 6 (Budget):** Look at v1's coverage charts (stacked bars), budget vs committed toggle.
- **Step 9 (Charts):** Look at v1's chart components, dark theme styling, KPI card layout.

**Do NOT copy v1's hardcoded Canada/US regions or corn-only assumptions.**

## PROJECT STRUCTURE
```
hedgelab-v2/
├── CLAUDE.md                    ← You are here
├── docs/
│   └── HEDGELAB_MASTER_v2.md    ← Master design document
├── src/
│   ├── app/                     ← Next.js app router
│   │   ├── api/                 ← API routes by module
│   │   │   ├── kernel/          ← Auth, RBAC, audit, FX, import
│   │   │   ├── trades/          ← tc_ plugin
│   │   │   ├── positions/       ← pm_ plugin
│   │   │   ├── budget/          ← bgt_ plugin
│   │   │   ├── market/          ← md_ plugin
│   │   │   ├── risk/            ← rsk_ plugin
│   │   │   ├── contracts/       ← ct_ plugin
│   │   │   ├── logistics/       ← lg_ plugin
│   │   │   ├── settlement/      ← stl_ plugin
│   │   │   ├── forecast/        ← fct_ plugin
│   │   │   └── energy/          ← nrg_ plugin
│   │   ├── (dashboard)/         ← Dashboard pages
│   │   ├── (positions)/         ← Position Manager pages
│   │   ├── (admin)/             ← Admin pages
│   │   └── layout.tsx           ← Root layout with dark theme
│   ├── components/
│   │   ├── ui/                  ← Shared UI components
│   │   ├── charts/              ← Chart components (Recharts)
│   │   ├── positions/           ← PM-specific components
│   │   ├── budget/              ← Budget-specific components
│   │   └── admin/               ← Admin-specific components
│   ├── lib/
│   │   ├── db.ts                ← Database connection
│   │   ├── audit.ts             ← Audit logger
│   │   ├── eventBus.ts          ← Event bus
│   │   ├── permissions.ts       ← RBAC middleware
│   │   ├── fx.ts                ← Currency conversion
│   │   ├── pricingEngine.ts     ← Formula evaluation
│   │   └── importEngine.ts      ← AI import service
│   ├── hooks/                   ← React hooks
│   ├── store/                   ← Zustand stores
│   └── types/                   ← TypeScript types
├── migrations/                  ← SQL migration files
│   ├── 001_kernel.sql
│   ├── 002_position_manager.sql
│   ├── 003_import_engine.sql
│   ├── 004_trade_capture.sql
│   ├── 005_market_data.sql
│   ├── 006_budget.sql
│   ├── 007_pricing_engine.sql
│   ├── 008_contracts_risk.sql
│   ├── 009_forecast.sql
│   ├── 010_logistics_settlement.sql
│   └── 011_energy.sql
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.local
```

## WHEN STARTING EACH STEP
1. Read the relevant section of `docs/HEDGELAB_MASTER_v2.md`
2. Create the migration file with exact SQL from the design doc
3. Build the API routes
4. Build the UI components
5. Wire up event listeners
6. Test the module works independently (with fallbacks for missing deps)
7. Test it works with previously built modules
