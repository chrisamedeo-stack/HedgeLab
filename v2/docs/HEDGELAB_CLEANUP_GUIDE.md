# HedgeLab v2 — Claude Code Cleanup Guide

> Copy-paste each prompt into Claude Code one at a time.
> Wait for each step to fully complete before starting the next.
> If Claude Code breaks something, tell it to fix the specific error rather than re-prompting the whole step.

---

## STEP 0: Update Design Docs

**Do this yourself in the terminal, not in Claude Code.**

Download the latest HEDGELAB_MASTER_v2.md and CLAUDE.md from this chat session, then copy them into your project:

```bash
# Adjust the source path to wherever you downloaded the files
cp ~/Downloads/HEDGELAB_MASTER_v2.md /mnt/c/Users/chris/HedgeLab/v2/docs/HEDGELAB_MASTER_v2.md
cp ~/Downloads/CLAUDE.md /mnt/c/Users/chris/HedgeLab/v2/CLAUDE.md
```

Verify they're in place:

```bash
head -5 /mnt/c/Users/chris/HedgeLab/v2/docs/HEDGELAB_MASTER_v2.md
head -5 /mnt/c/Users/chris/HedgeLab/v2/CLAUDE.md
```

You should see the updated content with the Market Data & Market View section (Section 9) including the Excel provider and provider abstraction layer.

---

## STEP 1: Remove Dead Java Server

**Why:** There's an abandoned Java Spring Boot api-server sitting in the project. All API routes are handled by Next.js at src/app/api/. The Java code is dead weight that wastes context window and could confuse you on future prompts.

**Prompt for Claude Code:**

```
Read CLAUDE.md first.

Delete the following files and directories that are leftover from an abandoned Java Spring Boot backend. The entire API layer is handled by Next.js API routes in src/app/api/:

1. Delete the entire api-server/ directory
2. Delete the root pom.xml file (this is a Maven config for the Java project)

Do NOT touch anything in src/, migrations/, docs/, or any other directory.

After deleting, update README.md to be a proper HedgeLab v2 readme. Replace the default create-next-app boilerplate with:

- Project name: HedgeLab v2 CTRM
- Tech stack: Next.js 16, React 19, PostgreSQL, Tailwind CSS 4, Zustand, Recharts
- Brief description: Commodity Trading & Risk Management platform
- How to run: npm install, set up .env.local with DATABASE_URL, npm run dev
- Note that the database runs in Docker: docker compose up -d postgres

Keep it short, no more than 30 lines.
```

---

## STEP 2: Fix API Path Inconsistency

**Why:** Some Zustand stores call `/api/v2/market/prices` while others call `/api/market/curves/compare`. There's a bandaid rewrite in next.config.ts that maps `/api/v2/` to `/api/`. This works but is confusing and fragile. Let's standardize everything to `/api/` since that's where the actual route files live.

**Prompt for Claude Code:**

```
Read CLAUDE.md first.

There's an API path inconsistency in the codebase. Some stores and hooks call /api/v2/ 
paths and others call /api/ paths. There's a rewrite rule in next.config.ts that maps 
/api/v2/ to /api/ as a bandaid.

Fix this by standardizing ALL API calls to use /api/ (no v2 prefix):

1. In every file in src/store/*.ts, replace any /api/v2/ paths with /api/
   Files to check: marketStore.ts, tradeStore.ts, positionStore.ts, importStore.ts, budgetStore.ts

2. In every file in src/hooks/*.ts, verify paths use /api/ not /api/v2/
   Files to check: useTrades.ts, useOrgHierarchy.ts, useImport.ts, usePositions.ts

3. Remove the rewrite rule from next.config.ts. The rewrites() function should return 
   an empty array or the whole rewrites block should be removed.

4. Search the entire src/ directory for any remaining /api/v2/ references and fix them.

Do NOT change any API route files in src/app/api/. Only change the client-side code that 
calls those routes. The actual route handlers stay exactly where they are.

After making changes, run: npx tsc --noEmit
Fix any TypeScript errors that result from the changes.
```

---

## STEP 3: Audit Migrations Against Master Design

**Why:** The md_prices and md_forward_curves tables are missing org_id (required for multi-tenancy). The market data module needs six new tables from the updated master design. There are also fixup migrations (014, 015, 017) suggesting schema drift.

**Prompt for Claude Code:**

```
Read CLAUDE.md and docs/HEDGELAB_MASTER_v2.md. Focus on Section 9 (Market Data & Market View).

The current market data migration (migrations/004_market_data.sql) is missing org_id on 
md_prices and md_forward_curves, and it's missing all the new tables from the updated 
master design.

Create a new migration file: migrations/023_market_data_v2.sql

This migration must:

1. ADD org_id to md_prices:
   - ALTER TABLE md_prices ADD COLUMN org_id UUID;
   - UPDATE md_prices SET org_id = (SELECT id FROM organizations LIMIT 1) WHERE org_id IS NULL;
   - ALTER TABLE md_prices ALTER COLUMN org_id SET NOT NULL;
   - DROP the existing unique constraint and recreate it INCLUDING org_id:
     UNIQUE(org_id, commodity_id, contract_month, price_date, price_type)
   - Recreate the lookup index to include org_id

2. ADD org_id to md_forward_curves:
   - Same pattern: add column, backfill, set NOT NULL, update unique constraint
   - UNIQUE(org_id, commodity_id, curve_date, contract_month)

3. ADD provider_id to md_prices and md_forward_curves:
   - ALTER TABLE md_prices ADD COLUMN provider_id UUID;
   - ALTER TABLE md_forward_curves ADD COLUMN provider_id UUID;

4. CREATE TABLE md_providers — per-org market data provider config:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - org_id UUID NOT NULL
   - provider_type VARCHAR(50) NOT NULL (values: "barchart", "dtn_iqfeed", "databento", "excel", "manual")
   - name VARCHAR(100) NOT NULL
   - is_primary BOOLEAN DEFAULT false
   - is_active BOOLEAN DEFAULT true
   - config JSONB NOT NULL DEFAULT '{}'
   - poll_interval_minutes INT DEFAULT 10
   - last_poll_at TIMESTAMPTZ
   - last_poll_status VARCHAR(20)
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - Index on org_id

5. CREATE TABLE md_symbol_map — maps HedgeLab commodity IDs to provider symbols:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - org_id UUID NOT NULL
   - provider_id UUID NOT NULL
   - commodity_id VARCHAR(20) NOT NULL
   - provider_symbol VARCHAR(50) NOT NULL
   - provider_root VARCHAR(20)
   - symbol_format VARCHAR(50) DEFAULT 'root_month_year'
   - unit VARCHAR(30)
   - price_format VARCHAR(20) DEFAULT 'decimal'
   - multiplier NUMERIC DEFAULT 1
   - is_active BOOLEAN DEFAULT true
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(org_id, provider_id, commodity_id)

6. CREATE TABLE md_basis — cash basis prices by location:
   - id BIGSERIAL PRIMARY KEY
   - org_id UUID NOT NULL
   - commodity_id VARCHAR(20) NOT NULL
   - site_id UUID (nullable, soft ref to sites)
   - location_name VARCHAR(200)
   - basis_date DATE NOT NULL
   - contract_month VARCHAR(10) NOT NULL
   - basis_value NUMERIC NOT NULL
   - cash_price NUMERIC
   - futures_price NUMERIC
   - bid_type VARCHAR(30)
   - source VARCHAR(50) DEFAULT 'manual'
   - provider_id UUID
   - import_job_id UUID
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - Index on (org_id, commodity_id, basis_date DESC)
   - Index on (site_id, basis_date DESC)

7. CREATE TABLE md_spreads — calendar spreads:
   - id BIGSERIAL PRIMARY KEY
   - org_id UUID NOT NULL
   - commodity_id VARCHAR(20) NOT NULL
   - near_month VARCHAR(10) NOT NULL
   - far_month VARCHAR(10) NOT NULL
   - spread_date DATE NOT NULL
   - spread_value NUMERIC NOT NULL
   - near_price NUMERIC
   - far_price NUMERIC
   - source VARCHAR(50) DEFAULT 'calculated'
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(org_id, commodity_id, near_month, far_month, spread_date)

8. CREATE TABLE md_watchlists — user price board configuration:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - user_id UUID NOT NULL
   - org_id UUID NOT NULL
   - name VARCHAR(100) DEFAULT 'Default'
   - items JSONB NOT NULL DEFAULT '[]'
   - is_default BOOLEAN DEFAULT true
   - created_at TIMESTAMPTZ DEFAULT NOW()

9. ADD new permissions:
   - market.upload_prices — Upload Excel price files
   - market.manage_providers — Configure market data providers
   - Grant both to admin role
   - Grant market.upload_prices to trader role

Wrap everything in BEGIN/COMMIT. Use ON CONFLICT DO NOTHING for permission inserts.
Show me the complete SQL file. Do NOT run it against the database yet — just create the file.
```

**After Claude Code creates the file, review it, then tell it:**

```
Apply migration 023 to the database:
docker exec -i hedgelab-postgres psql -U hedgelab -d hedgelab_v2 < migrations/023_market_data_v2.sql
```

---

## STEP 4: Rewrite Market Data Service Layer

**Why:** The current marketDataService.ts is 276 lines of basic CRUD with no provider abstraction, no Excel upload, no basis support. It needs to match the architecture from Section 9.4 of the master design.

**Prompt for Claude Code:**

```
Read CLAUDE.md and docs/HEDGELAB_MASTER_v2.md Section 9 thoroughly. Focus on 9.4 
(Provider Abstraction Layer) and 9.4b (Excel File Provider).

The current src/lib/marketDataService.ts is basic CRUD. It needs to be refactored into 
a proper provider abstraction layer. Here's exactly what to do:

STEP A: Create the type definitions file.

Create src/lib/marketData/types.ts with these interfaces:
- MarketDataProvider (the interface all providers implement)
  - providerType: string (readonly)
  - getLatestQuote(symbol: string): Promise<Quote>
  - getLatestQuotes(symbols: string[]): Promise<Quote[]>
  - getAllContractQuotes(root: string): Promise<Quote[]>
  - getHistoricalOHLC(symbol: string, startDate: Date, endDate: Date): Promise<OHLC[]>
  - getForwardCurve(root: string, date?: Date): Promise<CurvePoint[]>
  - getCashBids?(commodity: string, location?: string): Promise<BasisQuote[]>
- Quote { symbol, commodityId, contractMonth, lastPrice, open, high, low, close, 
         settlement?, bid?, ask?, volume, openInterest?, timestamp }
- OHLC { date, open, high, low, close, volume, openInterest? }
- CurvePoint { contractMonth, price, monthsToExpiry, volume?, openInterest? }
- BasisQuote { location, cashPrice, futuresPrice, basis, contractMonth, bidType?, timestamp }
- ExcelParseResult { prices: ParsedPrice[], basis: ParsedBasis[], warnings: string[], errors: string[] }
- ParsedPrice { priceDate, commodityId, contractMonth, settlement, open?, high?, low?, volume?, openInterest? }
- ParsedBasis { basisDate, commodityId, locationName, contractMonth, basisValue, cashPrice?, bidType? }

STEP B: Create the Manual provider.

Create src/lib/marketData/providers/manual.ts
- Implements MarketDataProvider
- getLatestQuotes reads from md_prices table with source='manual'
- Uses DISTINCT ON (commodity_id, contract_month) ordered by price_date DESC
- All queries filter by org_id

STEP C: Create the Excel provider.

Create src/lib/marketData/providers/excel.ts
This is the most important provider — it's our day-one default.
- static parseFile(buffer: Buffer, orgId: string): Promise<ExcelParseResult>
  - Uses the 'xlsx' npm package (add to dependencies if not present: npm install xlsx)
  - Reads "Settlements" sheet: columns date, commodity, contract, settlement, open, high, low, volume, open_interest
  - Reads optional "Basis" sheet: columns date, commodity, location, contract, basis, cash_price, bid_type
  - Validates commodity IDs against the commodities table
  - Returns structured ExcelParseResult with warnings for unknown commodities
- static commitPrices(orgId: string, providerId: string, parseResult: ExcelParseResult): Promise<CommitResult>
  - Batch inserts into md_prices (500 rows per batch using multi-row INSERT)
  - Builds forward curves for EVERY unique date in the file (not just the latest)
  - Calculates spreads for every date
  - Commits basis data, attempting to match location names to site names
  - Emits PRICES_UPDATED event
  - Returns { inserted, updated, basisRows, warnings }

STEP D: Create symbol map utilities.

Create src/lib/marketData/symbolMap.ts
- Month code constants: F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec
- contractMonthToDate(month: string): Date — converts "N26" to July 2026
- calculateMonthsToExpiry(contractMonth: string, asOf?: Date): number
- contractMonthToSortKey(contractMonth: string): number — for ordering contracts chronologically
- buildSymbol(root: string, contractMonth: string, format: string): string

STEP E: Rewrite the main service.

Rewrite src/lib/marketDataService.ts to be the MarketDataService class:
- getProvider(orgId: string) — reads md_providers, returns the right provider instance
- getPrice(orgId, commodityId, contractMonth) — cache-first, falls back to provider
- getMtmPrice(orgId, commodityId, contractMonth, asOfDate) — settlement preferred, then close
- getForwardCurve(orgId, commodityId, date?) — cache-first
- pollLatestPrices(orgId) — batch poll for all mapped commodities

CRITICAL: Keep all existing exported function signatures (createPrice, createPrices, 
getLatestPrice, getLatestPrices, listPrices, getForwardCurve, getForwardCurveComparison) 
working as wrapper functions that delegate to the new MarketDataService. This way nothing 
in the existing API routes, stores, or hooks breaks.

STEP F: Update the market API routes.

Update src/app/api/market/prices/route.ts to:
- Accept POST with multipart/form-data for Excel file uploads (in addition to existing JSON POST)
- When a file is uploaded, use ExcelProvider.parseFile() then ExcelProvider.commitPrices()
- Return the commit result with row counts and warnings

Add a new route: src/app/api/market/upload/route.ts
- POST endpoint specifically for Excel file uploads
- Accepts multipart/form-data with a single file field
- Returns { preview: ExcelParseResult } for preview mode (query param ?preview=true)
- Returns { result: CommitResult } for commit mode

All queries in updated routes must filter by org_id from the authenticated user's org.

After all changes, run: npx tsc --noEmit
Fix any TypeScript errors.
```

---

## STEP 5: Rebuild Market View Page

**Why:** The market page is currently a flat table with a manual entry form. It needs to become the full Market View with tabs for Price Board, Charts, Forward Curves, and Excel upload.

**Prompt for Claude Code:**

```
Read CLAUDE.md and docs/HEDGELAB_MASTER_v2.md Section 9.5 (Market View Tab).

Rebuild src/app/(positions)/market/page.tsx as a tabbed Market View. Use the same dark 
trading theme and layout patterns as the rest of the app. Reference 
src/app/(positions)/position-manager/page.tsx for the general page structure with header, 
KPIs, and content area.

The page should have 4 tabs:

TAB 1: PRICE BOARD (default tab)
- Grid layout: rows = commodities (from commodity context + all org commodities)
- For each commodity, show a sub-table with rows per contract month
- Columns: Contract, Last/Settle, Change, Change %, Open, High, Low, Volume, OI
- Change = today's settle minus yesterday's settle (calculate from md_prices)
- Color code: green text for positive change, red for negative
- Auto-refresh: refetch every 60 seconds (use setInterval)
- Click any contract month row to switch to the Chart tab for that contract
- Header shows "Last updated: [timestamp]" with a manual refresh button

TAB 2: CHART WORKSPACE
- Use lightweight-charts (already in package.json) for a candlestick chart
- Default: show the commodity from the commodity context switcher, front month contract
- Time range selector buttons: 1M, 3M, 6M, 1Y, All
- Volume bars below the chart
- Contract month selector dropdown to switch between months
- Data source: GET /api/market/prices with commodityId and contractMonth filters

TAB 3: FORWARD CURVES
- Line chart (use Recharts) showing price vs contract month
- X axis: contract months ordered chronologically (N26, Z26, H27, K27, N27...)
- Y axis: price
- Primary line: current curve (latest prices per contract month)
- Toggle to overlay comparison curves: "1 Week Ago", "1 Month Ago", "1 Year Ago"
- When toggled, fetch comparison data from GET /api/market/curves/compare
- Use the existing useForwardCurve hook and ForwardCurveChart component as starting points
  (src/components/charts/ForwardCurveChart.tsx already exists)

TAB 4: UPLOAD PRICES
- Drag-and-drop zone for .xlsx files (styled to match the app theme)
- On file drop:
  1. POST to /api/market/upload?preview=true with the file
  2. Show a preview table: parsed rows grouped by commodity with row counts
  3. Show any warnings (unknown commodities, missing fields) in yellow
  4. Show a summary: "42 prices across 3 commodities, dates 2024-01-02 to 2026-03-03"
  5. "Import" button to POST to /api/market/upload (without preview=true) to commit
  6. On success: show green toast "Imported X prices, Y basis rows" and switch to Price Board tab
- Below the drop zone, show a link: "Download template" (link to the .xlsx template)
- Keep the existing manual "Enter Prices" button as a secondary option

Additional UI details:
- Tab bar should use the same styling as other tabbed pages in the app
- Use consistent component patterns: DataTable for grids, KPICard for summary stats
- Loading states: show skeleton/spinner while fetching
- Empty states: show helpful message like "No price data yet. Upload an Excel file to get started."
- The page title should be "Market View" (not "Market Data")

Update the sidebar in src/app/(positions)/layout.tsx to rename the nav item from 
"Market Data" to "Market View".

Update src/hooks/useMarket.ts if you need new hooks for the upload flow or price board.
Update src/store/marketStore.ts if you need new store actions.
Update src/types/market.ts with any new types.

After all changes, run: npx tsc --noEmit
Fix any TypeScript errors.
```

---

## STEP 6: Verify Full Build

**Why:** After all the changes, we need to make sure everything compiles and nothing broke.

**Prompt for Claude Code:**

```
Run the following commands and fix ALL errors:

1. npx tsc --noEmit
   Fix every TypeScript error. Do not suppress errors with @ts-ignore or any.

2. npm run build
   Fix every build error. Common issues:
   - Missing imports after file moves
   - Type mismatches from updated interfaces
   - Broken references to deleted files (api-server)

3. After both commands pass clean, verify the market data module works end to end:
   - Check that GET /api/market/prices returns data (or empty array if no prices yet)
   - Check that GET /api/market/prices/latest?commodityId=CORN returns data
   - Check that POST /api/market/upload accepts a file

Do NOT add new features. Do NOT refactor other modules. Just fix errors and verify 
the build is clean.

List every file you changed and why.
```

---

## TIPS FOR WORKING WITH CLAUDE CODE

**Before each prompt**, you can prepend this to reload context:

```
Re-read CLAUDE.md and docs/HEDGELAB_MASTER_v2.md before starting.
```

**If Claude Code goes off track**, interrupt it and say:

```
Stop. You're deviating from what I asked. Let me restate what I need:
[restate the specific thing]
Do only that. Don't touch anything else.
```

**If Claude Code breaks something**, don't re-run the whole step:

```
The last change broke [specific thing]. The error is: [paste error].
Fix only this error. Do not change anything else.
```

**If Claude Code tries to do too much**, constrain it:

```
Do not refactor, rename, or reorganize any files I didn't specifically mention.
Only touch the files I listed.
```

**If you're unsure about a change Claude Code is proposing**, ask:

```
Before making that change, show me exactly what files you'll modify and what 
the diff will look like. Don't write anything yet.
```

---

## WHAT COMES AFTER CLEANUP

Once all 6 steps are done, you'll have:
- Clean project (no dead Java code)
- Consistent API paths
- Multi-tenant market data tables with org_id
- Provider abstraction layer ready for Excel now, Barchart/DTN later
- Excel upload working (parse, preview, commit)
- Market View page with Price Board, Charts, Forward Curves, Upload tabs
- Clean TypeScript build

Next priorities after cleanup:
1. Load your historical corn data via Excel upload
2. Verify candlestick charts and forward curves render with real data
3. Test MTM price resolution from the Risk module
4. Start building basis tracking for your sites
