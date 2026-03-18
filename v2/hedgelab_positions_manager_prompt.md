# HedgeLab v2 — Positions Manager Implementation Prompt
## Claude Code Prompt (Copy-Paste Ready)

---

## CONTEXT

You are building the **Positions Manager** module for HedgeLab v2, a multi-tenant commodity trading and risk management (CTRM) platform built with **Next.js, React, and PostgreSQL**, running in a WSL/Ubuntu environment at `/mnt/c/Users/chris/HedgeLab/v2`.

This module **replaces** the existing Contacts, Trades, and Position Manager screens in v2. All existing code for those screens should be deprecated and removed after the new module is wired in. Before writing any code, audit the existing codebase for:
- Any existing trade entry forms, position list views, or contact screens
- Existing API routes under `/api/trades`, `/api/positions`, `/api/contacts` or similar
- Any TypeScript types for trades, positions, or instruments
- Existing database tables: `trades`, `positions`, `contacts`, or similar

Document what you find. Then proceed with the implementation below, migrating or replacing as appropriate.

---

## FEATURE FLAGS

All optional capabilities are gated by a `tenant_features` table in PostgreSQL and a `useFeatureFlag(flag: string)` React hook. Features that are off are hidden from the UI entirely — no disabled states, no locked icons. The following flags must be implemented:

```typescript
type FeatureFlags = {
  physical_positions: boolean;       // Show Physical tab, physical instruments, physical entry form
  efp_module: boolean;               // EFP action and EFP nav item
  logistics_module: boolean;         // Logistics action, logistics column on Physical tab
  options_trading: boolean;          // Call/Put Option instruments, Strike/P-C/Premium/Delta columns
  swap_trading: boolean;             // Swap OTC instrument
  multi_portfolio: boolean;          // Portfolio selector, portfolio assignment on entry
  org_hierarchy: boolean;            // Breadcrumb drill-down; if false, show flat site picker
  basis_trading: boolean;            // Basis instrument type on Physical
  index_trading: boolean;            // Index instrument type on Physical
  budget_month: boolean;             // Budget Month field and filter everywhere
  roll_action: boolean;              // Roll action on Futures positions
  offset_close_action: boolean;      // Offset/Close action on Futures and Swaps
}
```

Store flags per tenant in `tenant_features(tenant_id, flag_name, enabled)`. Expose via a `/api/tenant/features` endpoint and cache in React context at app load.

---

## DATABASE SCHEMA

### 1. Org Hierarchy

```sql
-- Tier configuration per tenant (1-5 tiers, names set at onboarding)
CREATE TABLE org_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tier_level INTEGER NOT NULL,          -- 0 = Corporate (always exists), 1, 2, 3, 4
  tier_name VARCHAR(50) NOT NULL,       -- e.g. "Corporate", "Country", "Region", "Site"
  tier_name_plural VARCHAR(50) NOT NULL, -- e.g. "Countries", "Regions", "Sites"
  is_leaf BOOLEAN NOT NULL DEFAULT false, -- true for the lowest tier (where positions live)
  UNIQUE(tenant_id, tier_level)
);

-- Org nodes (one table for all tiers, self-referencing)
CREATE TABLE org_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  parent_id UUID REFERENCES org_nodes(id),
  tier_level INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_nodes_tenant ON org_nodes(tenant_id);
CREATE INDEX idx_org_nodes_parent ON org_nodes(parent_id);
```

### 2. Portfolios

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  commodity VARCHAR(50),              -- NULL means all commodities
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Trades (unified table replacing all existing trade tables)

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  trade_id VARCHAR(20) NOT NULL,         -- Human-readable e.g. TRD-0041
  trade_date DATE NOT NULL,
  category VARCHAR(10) NOT NULL CHECK (category IN ('financial', 'physical')),

  -- Common fields
  commodity VARCHAR(50) NOT NULL,
  instrument VARCHAR(20) NOT NULL CHECK (instrument IN (
    'futures', 'swap_otc', 'call_option', 'put_option',  -- financial
    'fixed_price', 'hta', 'basis', 'index'               -- physical
  )),
  direction VARCHAR(5) NOT NULL CHECK (direction IN ('long', 'short', 'buy', 'sell')),
  quantity NUMERIC(14,2) NOT NULL,       -- bushels or units
  portfolio_id UUID REFERENCES portfolios(id),  -- required for financial, optional for physical
  site_id UUID REFERENCES org_nodes(id), -- the leaf org node this position belongs to
  budget_month DATE,                     -- stored as first day of month

  -- Financial fields
  contracts INTEGER,
  contract_month VARCHAR(10),            -- e.g. "Dec 26"
  trade_price NUMERIC(12,5),
  market_price NUMERIC(12,5),            -- updated by market data feed
  strike NUMERIC(12,5),
  put_call CHAR(1) CHECK (put_call IN ('P', 'C')),
  premium NUMERIC(12,5),
  delta NUMERIC(6,4),

  -- Physical fields
  basis NUMERIC(10,5),
  board_month VARCHAR(10),
  flat_price NUMERIC(12,5),
  is_priced BOOLEAN NOT NULL DEFAULT false,
  delivery_location_id UUID REFERENCES org_nodes(id), -- may differ from site_id
  logistics_assigned BOOLEAN NOT NULL DEFAULT false,

  -- EFP linkage
  efp_id UUID REFERENCES efp_transactions(id),

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_trades_tenant ON trades(tenant_id);
CREATE INDEX idx_trades_site ON trades(site_id);
CREATE INDEX idx_trades_portfolio ON trades(portfolio_id);
CREATE INDEX idx_trades_category ON trades(tenant_id, category);
CREATE INDEX idx_trades_instrument ON trades(tenant_id, instrument);
```

### 4. EFP Transactions (feature-flagged)

```sql
CREATE TABLE efp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  financial_trade_id UUID REFERENCES trades(id),
  physical_trade_id UUID REFERENCES trades(id),
  efp_date DATE NOT NULL,
  efp_price NUMERIC(12,5),
  contracts INTEGER,
  quantity NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

---

## API ROUTES

Build the following Next.js API routes under `/app/api/` (App Router):

### Org Hierarchy
```
GET  /api/org/tiers              → tier config for current tenant
GET  /api/org/nodes              → all org nodes for current tenant
GET  /api/org/nodes/[id]/children → direct children of a node
GET  /api/org/nodes/[id]/sites   → all leaf nodes beneath a node
```

### Portfolios
```
GET  /api/portfolios             → list portfolios for current tenant
POST /api/portfolios             → create portfolio
```

### Trades / Positions
```
GET  /api/trades                 → list trades with filters (see below)
POST /api/trades                 → create trade
GET  /api/trades/[id]            → single trade detail
PUT  /api/trades/[id]            → update trade
DELETE /api/trades/[id]          → soft delete (set is_active = false)

-- Bulk actions
POST /api/trades/bulk/define-site
POST /api/trades/bulk/define-budget-month
POST /api/trades/bulk/assign-portfolio
POST /api/trades/bulk/efp          (feature-flagged)
POST /api/trades/bulk/logistics    (feature-flagged)
POST /api/trades/bulk/roll         (feature-flagged)
POST /api/trades/bulk/offset-close (feature-flagged)
POST /api/trades/bulk/price-fix
POST /api/trades/bulk/add-basis
```

### GET /api/trades query parameters:
```typescript
{
  category: 'financial' | 'physical'
  org_node_id?: string       // scope to this node and all children
  portfolio_id?: string
  commodity?: string
  instrument?: string
  direction?: string
  is_priced?: boolean
  delivery_location_id?: string
  budget_month?: string      // YYYY-MM
  page?: number
  page_size?: number         // default 100
}
```

### Feature Flags
```
GET  /api/tenant/features        → all feature flags for current tenant
PUT  /api/tenant/features/[flag] → toggle a flag (admin only)
```

---

## REACT COMPONENT ARCHITECTURE

```
/app/(app)/positions/
  layout.tsx                    ← positions layout with org breadcrumb + portfolio selector
  page.tsx                      ← redirects to /positions/financial
  financial/
    page.tsx                    ← Financial Positions view
  physical/
    page.tsx                    ← Physical Positions view (feature-flagged: physical_positions)

/components/positions/
  PositionsLayout.tsx            ← wrapper with breadcrumb, portfolio selector, toggle
  OrgBreadcrumb.tsx              ← cascading 1-5 tier drill-down breadcrumb
  PortfolioSelector.tsx          ← cross-cutting portfolio filter (feature-flagged: multi_portfolio)
  PositionToggle.tsx             ← Financial / Physical tab toggle
  FinancialPositionsTable.tsx    ← financial table with dynamic columns
  PhysicalPositionsTable.tsx     ← physical table with dynamic columns
  PositionFilters.tsx            ← filter bar that adapts to tab and feature flags
  PositionContextMenu.tsx        ← right-click action menu, instrument-aware
  PositionBulkActionMenu.tsx     ← Take Action dropdown for selected rows
  NewFinancialPositionForm.tsx   ← entry form for financial trades
  NewPhysicalPositionForm.tsx    ← entry form for physical trades (feature-flagged)
  PositionDetailPanel.tsx        ← side panel for View Details

/hooks/
  useOrgHierarchy.ts             ← fetches and caches org tier config + nodes
  usePositions.ts                ← fetches trades with current filters applied
  useFeatureFlag.ts              ← reads from FeatureFlagContext
  useOrgScope.ts                 ← manages breadcrumb state + cascading resets

/context/
  FeatureFlagContext.tsx         ← loads flags at app start, provides useFeatureFlag()
  OrgScopeContext.tsx            ← current breadcrumb scope, shared across tabs
```

---

## ORG BREADCRUMB — DETAILED BEHAVIOR

This is the most critical UI component. Implement it exactly as follows:

```typescript
// OrgBreadcrumb renders one picker per configured tier
// Each picker shows "All [TierNamePlural]" as default
// Selecting a value resets all tiers to the right to "All"
// The org scope drives all position queries

interface OrgScope {
  [tierLevel: number]: string | null  // null = "All"
}

// Example for 4-tier org:
// { 0: 'acme-corp-id', 1: null, 2: null, 3: null }
// means: scoped to Acme Corp, all Countries, all Regions, all Sites
```

**Cascading rules:**
- Tier 0 (Corporate) is always set — it is the tenant root, not selectable
- Selecting tier N resets tiers N+1 through max to null
- Options for tier N are filtered to children of the selected tier N-1 node
- When the leaf tier is selected, hide the Location filter on Physical (redundant)
- The "All [TierNamePlural]" option always appears first in each dropdown

**Adaptive labels:**
- Read tier names from `org_tier_config` via `useOrgHierarchy()`
- Breadcrumb "All" label: `"All " + tier.tier_name_plural`
- Filter pill label on Physical tab: leaf tier's `tier_name` (e.g. "Site", "Facility", "Location")
- Action menu item "Define Site" → `"Define " + leafTier.tier_name`
- Column header "Delivery Location" → can remain generic or adapt to leaf tier name

---

## FINANCIAL POSITIONS TABLE

**Column order (fixed, left to right):**

| # | Column | Notes |
|---|---|---|
| 1 | Checkbox | Row selection |
| 2 | Trade ID | Blue, monospace, 10px |
| 3 | Trade Date | MM/DD/YY |
| 4 | Direction | ▲ Long (green) / ▼ Short (red) |
| 5 | Contracts | Right-aligned, dim. Hide if options_trading=false and swap_trading=false |
| 6 | Quantity | Right-aligned, formatted with commas |
| 7 | Contract Mo. | Dim text |
| 8 | Commodity | Plain text |
| 9 | Instrument | Colored badge per type |
| 10 | Strike | Right-aligned, dim. Only show column if options_trading=true |
| 11 | P/C | Amber bold. Only show column if options_trading=true |
| 12 | Trade Price | Right-aligned |
| 13 | Mkt Price | Right-aligned. Color: red if above trade price (adverse), green if below |
| 14 | Portfolio | Tag badge. Only show column if multi_portfolio=true |

**Financial filters:**
- Commodity (always)
- Instrument (always; options removed if options_trading=false, swaps if swap_trading=false)
- Direction (always)

**Financial context menu actions (instrument-aware):**

```typescript
const FINANCIAL_ACTIONS = {
  'Define Site':         { instruments: ['futures','swap_otc','call_option','put_option'], flag: null },
  'Define Budget Month': { instruments: ['futures','swap_otc','call_option','put_option'], flag: 'budget_month' },
  'EFP':                 { instruments: ['futures'], flag: 'efp_module' },
  'Roll':                { instruments: ['futures'], flag: 'roll_action' },
  'Offset / Close':      { instruments: ['futures','swap_otc'], flag: 'offset_close_action' },
  'Exercise':            { instruments: ['call_option','put_option'], flag: 'options_trading' },
  'View Details':        { instruments: ['futures','swap_otc','call_option','put_option'], flag: null },
}
// An action is shown only if:
// 1. The trade's instrument is in the action's instruments array
// 2. The action's flag is null OR that flag is enabled for this tenant
```

---

## PHYSICAL POSITIONS TABLE

Only render this tab if `physical_positions` feature flag is true.

**Column order (fixed, left to right):**

| # | Column | Notes |
|---|---|---|
| 1 | Checkbox | Row selection |
| 2 | Trade ID | Blue, monospace, 10px |
| 3 | Trade Date | MM/DD/YY |
| 4 | Direction | ▲ Buy (green) / ▼ Sell (red) |
| 5 | Quantity | Right-aligned, formatted with commas |
| 6 | Commodity | Plain text |
| 7 | Instrument | Colored badge per type |
| 8 | Delivery Location | Leaf org node name. "undefined" in italic+dim if null. Adapt label to leaf tier name. |
| 9 | Budget Month | "undefined" in italic+dim if null. Only show if budget_month=true |
| 10 | Basis | Right-aligned. Red if negative, green if positive. "—" if null |
| 11 | Board Month | Dim text |
| 12 | Flat Price | Right-aligned. "—" if unpriced |
| 13 | Status | ● Priced (green) / ○ Unpriced (amber) |
| 14 | Logistics | Dot indicator + "Assigned"/"None". Only show if logistics_module=true |
| 15 | Portfolio | Tag badge. Only show if multi_portfolio=true |

**Physical filters:**
- Commodity (always)
- Instrument (adapted: remove Basis if basis_trading=false, Index if index_trading=false)
- Direction (always)
- Location (leaf tier name from org config; hidden when breadcrumb is at leaf level; options cascade from breadcrumb scope)
- Budget Month (only if budget_month=true; options: months that exist + "(Undefined)")
- Priced / Not Priced (always)

**Physical context menu actions:**

```typescript
const PHYSICAL_ACTIONS = {
  'Define Location':     { instruments: ['fixed_price','hta','basis','index'], flag: null },
  'Define Budget Month': { instruments: ['fixed_price','hta','basis','index'], flag: 'budget_month' },
  'Assign Portfolio':    { instruments: ['fixed_price','hta','basis','index'], flag: 'multi_portfolio' },
  'Add Basis':           { instruments: ['hta','index'], flag: 'basis_trading' },
  'Price / Fix':         { instruments: ['hta','basis','index'], flag: null },
  'EFP':                 { instruments: ['fixed_price','hta'], flag: 'efp_module' },
  'Logistics':           { instruments: ['fixed_price','hta','basis','index'], flag: 'logistics_module' },
  'View Details':        { instruments: ['fixed_price','hta','basis','index'], flag: null },
}
```

---

## FILTER BAR — BEHAVIOR RULES

The filter bar is a shared component `<PositionFilters />` that receives the current tab and feature flags as props and renders only the relevant pills.

**Rules:**
1. All filter pills are single-select dropdowns with an "All" default
2. Active filters show as removable chips below the filter bar
3. Clearing a chip or clicking "✕ Clear" resets that filter to "All"
4. Changing the org breadcrumb scope resets ALL filters — the data set changed
5. Changing tabs (Financial ↔ Physical) resets ALL filters
6. Location filter options are always scoped to the current breadcrumb selection — never show sites outside the current org scope
7. Portfolio filter options are scoped to portfolios that have at least one position within the current org scope and current tab

---

## NEW POSITION ENTRY FORMS

### NewFinancialPositionForm

Required fields:
- Trade Date (date picker, defaults to today)
- Direction (Long / Short toggle)
- Contracts (integer, required for Futures/Options, hidden for Swaps)
- Quantity (auto-calculated from contracts × contract size if Futures, manual for Swaps)
- Contract Month (month/year picker)
- Commodity (dropdown from tenant commodity list)
- Instrument (Futures always; Swap OTC if swap_trading=true; Call/Put Option if options_trading=true)
- Strike (required if Call or Put Option)
- P/C (auto-set from instrument selection)
- Trade Price (required for Futures/Swaps, this is the premium for Options)
- Portfolio (required; dropdown from tenant portfolios; only show if multi_portfolio=true)
- Site (required; leaf-level org node picker — cascading from org hierarchy)
- Budget Month (optional; only show if budget_month=true)

On submit: POST /api/trades, refresh table, show success toast.

### NewPhysicalPositionForm (feature-flagged: physical_positions)

Required fields:
- Trade Date (date picker, defaults to today)
- Direction (Buy / Sell toggle)
- Quantity (bushels, manual entry)
- Commodity (dropdown)
- Instrument (Fixed Price always; HTA always; Basis if basis_trading=true; Index if index_trading=true)
- Portfolio (optional; only show if multi_portfolio=true)
- Site (leaf-level org node picker)

Conditional fields (shown based on instrument):
- Basis (required for Basis instrument; optional for HTA)
- Board Month (required for HTA and Basis; optional for Fixed Price)
- Delivery Location (optional at entry — can be defined later via action)
- Budget Month (optional at entry; only show if budget_month=true)

On submit: POST /api/trades, refresh table.

---

## VISUAL DESIGN

Maintain the existing HedgeLab v2 dark trading terminal aesthetic:

```typescript
// Color palette — use CSS variables throughout
const colors = {
  bg0: '#0B1426',      // page background
  bg1: '#111D32',      // nav, topbar, footer
  bg2: '#1A2740',      // table header, hover states
  bg3: '#223352',      // elevated elements
  blue: '#378ADD',     // primary action, trade IDs, active states
  gain: '#1D9E75',     // long/buy direction, positive values
  loss: '#D85A30',     // short/sell direction, negative values
  amber: '#BA7517',    // warnings, unpriced status
  amberLt: '#FAC775',  // P/C column, unpriced indicator text
  text: '#C8D8F0',     // primary text
  text2: '#7A92B4',    // secondary/dim text
  text3: '#4A6080',    // hints, placeholders
  border: '#1E3050',   // subtle borders
  border2: '#2A4060',  // emphasis borders
}

// Instrument badge colors
const instrumentBadges = {
  futures:     { bg: '#0A2540', color: '#5BB0FF', border: '#1A3D6A' },
  swap_otc:    { bg: '#1A1040', color: '#9A80FF', border: '#302060' },
  call_option: { bg: '#2A1030', color: '#FF80C0', border: '#501840' },
  put_option:  { bg: '#301015', color: '#FF6090', border: '#601828' },
  fixed_price: { bg: '#0A2A18', color: '#4ACA94', border: '#155030' },
  hta:         { bg: '#1A2810', color: '#90C840', border: '#304010' },
  basis:       { bg: '#2A1408', color: '#E08050', border: '#502010' },
  index:       { bg: '#2A2010', color: '#D4A840', border: '#504010' },
}
```

Font: `JetBrains Mono` or `Fira Code` for the table. System sans-serif for forms.

---

## NAV STRUCTURE

The left nav should reflect this structure (items hidden if feature flags are off):

```
Main
  ◈  Dashboard
  ▤  Reports
  ◎  Budgets / Forecasts
  ⊞  Positions              ← replaces Contacts, Trades, Position Manager

Tools
  ⬡  Market Data

Frequent Actions
  ⇄  EFP                   ← only if efp_module=true
  ⊕  Logistics             ← only if logistics_module=true

System
  ⚙  Admin
```

Remove any existing nav items for Contacts, Trades, or Position Manager.

---

## MIGRATION TASKS

The live database is `hedgelab_v2` in Docker container `hedgelab-postgres`, user `hedgelab`.
Connect with: `docker exec -it hedgelab-postgres psql -U hedgelab -d hedgelab_v2`

### Tables to migrate INTO the new `trades` table

The existing schema splits financial trades across multiple tables. Before writing migration SQL, inspect each table's columns:

```sql
\d+ tc_financial_trades       -- parent financial trade record
\d+ tc_futures_details        -- futures-specific columns (joined to tc_financial_trades)
\d+ tc_option_details         -- options-specific columns (put_call, strike, premium, delta)
\d+ tc_swap_details           -- swap-specific columns
\d+ tc_swap_settlements       -- swap settlement records
\d+ ct_physical_contracts     -- physical contract records
\d+ pm_physical_positions     -- physical position manager records (check overlap with ct_physical_contracts)
\d+ pm_allocations            -- position allocations → become portfolio assignments
\d+ pm_locked_positions       -- locked position flags
\d+ pm_rollovers              -- roll transactions
\d+ pm_rollover_legs          -- roll legs
\d+ pm_rollover_costs         -- roll costs
```

Migration logic:
- `tc_financial_trades` + `tc_futures_details` → `trades` (category='financial', instrument='futures')
- `tc_financial_trades` + `tc_option_details` (put_call='C') → `trades` (instrument='call_option')
- `tc_financial_trades` + `tc_option_details` (put_call='P') → `trades` (instrument='put_option')
- `tc_financial_trades` + `tc_swap_details` → `trades` (instrument='swap_otc')
- `ct_physical_contracts` → `trades` (category='physical', instrument mapped from contract type)
- `pm_physical_positions` → `trades` (category='physical'; deduplicate against ct_physical_contracts)
- `pm_rollovers` + `pm_rollover_legs` + `pm_rollover_costs` → `efp_transactions` or new `rollover_transactions` table

### Org hierarchy mapping

Inspect then migrate:
```sql
\d+ org_hierarchy_levels    -- maps to org_tier_config (tier names, plural names)
\d+ org_units               -- maps to org_nodes (non-leaf tiers)
\d+ organizations           -- tenant root node (tier_level=0)
\d+ sites                   -- maps to org_nodes (is_leaf=true)
\d+ site_groups             -- evaluate: may map to portfolios or archive
\d+ site_group_members      -- archive after migration
```

### Feature flags mapping

```sql
\d+ org_plugins             -- likely existing feature flag records → seed tenant_features
\d+ plugin_registry         -- flag definitions → map to new FeatureFlags type
-- Default all flags to true for existing tenant to preserve current behavior
```

### Tables to KEEP — reference only, do not modify

```
md_basis                    market data: basis prices
md_forward_curves           market data: forward curves → source for Mkt Price column
md_prices                   market data: current prices
md_providers                market data provider config
md_spreads                  spread data
md_symbol_map               commodity → exchange symbol mapping
md_watchlists               user watchlists
lg_deliveries               logistics delivery records (logistics_module flag)
lg_inventory                inventory records (logistics_module flag)
rsk_limit_checks            risk limit enforcement
rsk_mtm_snapshots           mark-to-market snapshots
rsk_pnl_attribution         P&L attribution
rsk_position_limits         position limit config
bgt_comparisons             budget vs actual
bgt_forecast_history        forecast history
bgt_line_item_components    budget components
bgt_line_items              budget line items
bgt_periods                 budget periods
bgt_versions                budget versions
pricing_applied             applied pricing records
pricing_formulas            pricing formula definitions
pricing_rate_tables         rate tables for formula pricing
stl_invoices                settlement invoices
audit_log                   preserve all audit records
event_log                   preserve all event records
commodities                 commodity master list
commodity_assignments       commodity-to-org assignments
commodity_contract_calendar futures contract calendar
commodity_groups            commodity groupings
commodity_units             unit of measure definitions
fx_rates                    foreign exchange rates
users                       user accounts
roles / permissions         access control
```

### Tables to ARCHIVE after migration is verified

```
tc_financial_trades         replaced by trades (category='financial')
tc_futures_details          merged into trades
tc_option_details           merged into trades
tc_swap_details             merged into trades
tc_swap_settlements         migrated to settlement structure
ct_physical_contracts       replaced by trades (category='physical')
pm_physical_positions       replaced by trades (category='physical')
pm_allocations              replaced by portfolio_id on trades
pm_locked_positions         add is_locked column to trades; archive this table
pm_rollovers                migrated to rollover_transactions
pm_rollover_legs            merged into rollover_transactions
pm_rollover_costs           merged into rollover_transactions
ct_counterparties           archive; counterparty reference kept on trades
```

### Migration verification — run after migration, before archiving

```sql
-- Financial trades count must match
SELECT COUNT(*) FROM tc_financial_trades;
SELECT COUNT(*) FROM trades WHERE category = 'financial';

-- Physical trades count (watch for ct vs pm overlap)
SELECT COUNT(*) FROM ct_physical_contracts;
SELECT COUNT(*) FROM pm_physical_positions;
SELECT COUNT(*) FROM trades WHERE category = 'physical';

-- Org nodes count
SELECT COUNT(*) FROM org_units;
SELECT COUNT(*) FROM sites;
SELECT COUNT(*) FROM org_nodes;   -- should equal org_units + sites + 1 (root)
```

Do NOT drop archived tables until row counts are verified and the new UI has been running for at least one billing cycle.

---

## IMPLEMENTATION ORDER

Do not skip steps. Complete each fully before moving to the next.

1. **Schema** — Run all migrations. Verify tables exist with correct columns and indexes.
2. **Feature flags** — Implement `tenant_features` table, `/api/tenant/features` endpoint, `FeatureFlagContext`, and `useFeatureFlag()` hook.
3. **Org hierarchy** — Implement `org_tier_config` and `org_nodes` tables, all `/api/org/` endpoints, `useOrgHierarchy()` hook, and `OrgBreadcrumb` component with full cascading behavior.
4. **Portfolios** — Implement `portfolios` table, `/api/portfolios` endpoint, `PortfolioSelector` component.
5. **Trades API** — Implement `/api/trades` GET with all filter parameters. Test with Postman or curl before building UI.
6. **Financial Positions Table** — Build `FinancialPositionsTable` with all columns, filters, context menu, and bulk actions. Wire to live API.
7. **Physical Positions Table** — Build `PhysicalPositionsTable` behind `physical_positions` feature flag.
8. **Entry Forms** — Build `NewFinancialPositionForm` and `NewPhysicalPositionForm`.
9. **Bulk actions** — Implement all bulk action endpoints and wire to UI.
10. **Migration** — Migrate existing data. Verify row counts match. Remove deprecated code.
11. **Feature flag audit** — Toggle each flag on and off and verify UI adapts correctly with no broken states, missing columns, or console errors.

---

## TESTING CHECKLIST

Before considering this complete, verify:

- [ ] All feature flags toggle correctly — UI hides/shows appropriate elements
- [ ] Org breadcrumb cascades correctly — selecting tier N resets N+1 onward
- [ ] Location filter options match current breadcrumb scope exactly
- [ ] Context menu shows only actions valid for the row's instrument AND enabled flags
- [ ] Financial and Physical tables have zero column overlap issues
- [ ] New position forms validate all required fields before submitting
- [ ] Portfolio filter only shows portfolios with positions in current scope
- [ ] "Define [LeafTierName]" action label adapts to tenant's tier name config
- [ ] All filter pills reset when tab changes or breadcrumb scope changes
- [ ] Bulk actions apply only to selected rows of the current tab
- [ ] Existing trade data is preserved and correctly categorized after migration
- [ ] No references to deprecated Contacts, Trades, or Position Manager routes remain
