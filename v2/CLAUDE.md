# HedgeLab v2 — Claude Code Instructions

## READ FIRST
Before doing ANY work, read the master design document:
```
cat docs/HEDGELAB_MASTER_v2.md
```
This is the single source of truth. Every table schema, service function, event, and permission is defined there. Do not deviate from it.

## CRITICAL RULES

### Scalability — Nothing Hardcoded
- **No hardcoded regions, geographies, or country names** in any code. Regions come from `site_groups` table.
- **No hardcoded commodity names** (no "CORN" string literals in UI logic). Commodities come from the `commodities` table.
- **No hardcoded site types.** Site types come from `site_types` table.
- Every dropdown, tab group, filter, and navigation element that displays regions, commodities, site types, or site groups must be **data-driven from the database**.
- Seed data is example-only. The system must work with zero seed data if an org configures everything themselves.

### Architecture — Kernel + Plugins
- Only the kernel is required. Every plugin is optional.
- **No foreign keys across module boundaries.** Use soft UUID references.
- Every plugin must define fallback behavior when its dependencies are missing.
- Plugins communicate through the event bus (`lib/eventBus.js`), never direct imports.
- Table naming: kernel tables have no prefix. Plugin tables use their prefix (`tc_`, `pm_`, `bgt_`, etc.).

### Data Integrity
- All financial values: `NUMERIC` type. Never `FLOAT` or `DOUBLE`.
- All timestamps: `TIMESTAMPTZ`. Never `TIMESTAMP`.
- All tables with financial data include a `currency` field.
- Every data mutation calls `auditLog()` with before/after snapshots.
- Every action checks permissions via `checkPermission()`.

### UI
- Dark trading theme. Reference v1 for color scheme and layout patterns.
- Region/site grouping tabs are rendered dynamically from database queries.
- The 4-section site view layout (hedges → physical commitments → open board → all-in summary) is the core UX pattern.
- EFP is handled behind the scenes — user clicks "lock", system executes EFP logic invisibly.
- Offset only allowed from site level, never from hedge book.

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
├── prisma/
│   └── schema.prisma            ← Or use raw SQL migrations
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
