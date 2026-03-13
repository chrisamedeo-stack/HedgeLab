# HedgeLab CTRM — Master System Design (v2 Rebuild)

> **CONTEXT FOR CLAUDE CODE:** This is a rebuild of an existing system. HedgeLab v1 is a working CTRM with a Position Manager, hedge books, EFP/offset workflows, coverage charts, and a dark trading UI — all built with Claude Code in a Next.js/React stack on Ubuntu/WSL. This v2 rebuild keeps the same UX patterns and business logic but restructures everything around a modular kernel + plugin architecture with proper RBAC, audit trail, event bus, and formula pricing.
>
> **CRITICAL — SCALABILITY PRINCIPLE:** Nothing in this system should be hardcoded to a specific customer, geography, commodity, or business model. v1 had "Canada" and "US" as hardcoded tabs — v2 replaces that with a data-driven region/site group system. A new customer should be able to set up their own regions (e.g., "Midwest", "Gulf Coast", "Alberta"), their own site types, their own commodities, and their own pricing formulas — all through configuration and the Admin UI, with zero code changes. Every UI that groups or filters by region, commodity, or site type must pull from the database, never from constants.
>
> Throughout this document, **[V1 REFERENCE]** notes tell you where the existing v1 codebase has working implementations to reference for UI patterns, business logic, or design decisions. **Do not copy v1 code directly** — the architecture is different — but use it as the source of truth for how the feature should look and behave. **Do not copy v1's hardcoded regions or commodity assumptions.**
>
> **Read this entire document before starting any work. Follow the build order in Section 14.**

---

## 1. Design Philosophy

1. Each module works independently. No module breaks because another module isn't built yet.
2. Only the **kernel** is required. Everything else is an optional plugin.
3. Cross-module references use **soft IDs** (no foreign keys across module boundaries).
4. Every plugin defines **fallback behavior** for missing dependencies.
5. Plugins communicate through an **event bus**, never direct imports.
6. Every data mutation is **audited** with field-level before/after tracking.
7. Every action is **permission-checked** through a centralized RBAC system.
8. All financial values use **NUMERIC/DECIMAL**, never floating point.
9. All tables that hold financial data include **currency** fields and use the kernel FX service for conversion.
10. Positions carry full history through rollover chains — no orphaned P&L.
11. **Nothing is hardcoded to a specific customer, geography, commodity, or business model.** Regions, site types, commodities, pricing formulas, dashboard layouts, KPI selections, and grouping logic are all data-driven and configured through the Admin UI. Seed data is example-only — every org defines their own.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     KERNEL (required)                        │
│  Commodity Registry · Contract Calendar · Sites & Types      │
│  Users & RBAC · Audit System · FX Rates · Event Bus         │
│  AI Import Engine · Formula Pricing Engine                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                  ┌────────┴────────┐
                  │   EVENT BUS     │
                  └────────┬────────┘
                           │
      ┌──────────┬─────────┼─────────┬──────────┬──────────┐
      ▼          ▼         ▼         ▼          ▼          ▼
 ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │ Trade  │ │Position│ │ Risk │ │Contract│ │Logistics│ │Settle- │
 │Capture │ │Manager │ │      │ │        │ │         │ │ment    │
 └────────┘ └────────┘ └──────┘ └────────┘ └────────┘ └────────┘
   Plugin     Plugin    Plugin   Plugin      Plugin     Plugin

 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │ Market │ │ Budget │ │Forecast│ │ Energy │
 │ Data   │ │        │ │        │ │        │
 └────────┘ └────────┘ └────────┘ └────────┘
   Plugin     Plugin     Plugin     Plugin
```

### Tech Stack

**[V1 REFERENCE]:** v1 uses Next.js + React. Keep the same stack. The dark trading theme, component patterns, and page structure from v1 should carry forward visually.

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript + Tailwind | Dark trading theme from v1 |
| State | Zustand | Simpler than Redux for this scale |
| Charts | Recharts + Lightweight Charts | Candlestick support for market data |
| API | Next.js API routes | Full-stack JS, fast iteration |
| Database | PostgreSQL | NUMERIC for financials, JSONB for config |
| Cache | Redis | Market data, sessions |
| Auth | NextAuth or Clerk | Multi-tenant RBAC |
| Real-time | Socket.io | Live prices, position updates |
| Queue | BullMQ | Background MTM calcs, report gen, AI imports |
| Storage | S3-compatible | Contract docs, import files |
| AI Import | Claude API (Sonnet) | File parsing, field mapping, validation |

---

## 3. Kernel — Core Tables

### 3.1 Commodity Registry

```sql
CREATE TABLE commodities (
  id              VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  category        VARCHAR(20) NOT NULL DEFAULT 'ag',
  unit            VARCHAR(20) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  contract_size   NUMERIC,
  tick_size       NUMERIC,
  tick_value      NUMERIC,
  exchange        VARCHAR(20),
  contract_months VARCHAR(24),
  decimal_places  INT DEFAULT 2,
  is_active       BOOLEAN DEFAULT true,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- [V1 REFERENCE]: v1 was corn-only. Seed with initial commodities.
-- These are EXAMPLE seeds. Orgs add/configure their own commodities via Admin UI.
INSERT INTO commodities (id, name, category, unit, contract_size, tick_size, tick_value, exchange, contract_months)
VALUES
  ('CORN', 'Corn', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'HKNUZ'),
  ('SOYBEAN', 'Soybeans', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'FHKNQUX'),
  ('WHEAT', 'Wheat (SRW)', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'HKNUZ'),
  ('SOYOIL', 'Soybean Oil', 'ag', 'pounds', 60000, 0.01, 6.00, 'CBOT', 'FHKNQUVZ'),
  ('SOYMEAL', 'Soybean Meal', 'ag', 'short tons', 100, 0.10, 10.00, 'CBOT', 'FHKNQUVZ');
```

### 3.2 Contract Calendar

```sql
CREATE TABLE commodity_contract_calendar (
  id              BIGSERIAL PRIMARY KEY,
  commodity_id    VARCHAR(20) NOT NULL,
  contract_month  VARCHAR(10) NOT NULL,
  first_notice_date   DATE,
  last_trade_date     DATE,
  expiration_date     DATE,
  first_delivery_date DATE,
  last_delivery_date  DATE,
  is_active       BOOLEAN DEFAULT true,
  source          VARCHAR(50) DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, contract_month)
);

CREATE INDEX idx_cal_commodity ON commodity_contract_calendar(commodity_id, contract_month);
CREATE INDEX idx_cal_expiry ON commodity_contract_calendar(last_trade_date);

CREATE OR REPLACE FUNCTION get_contract_deadlines(p_commodity VARCHAR, p_month VARCHAR)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'first_notice_date', first_notice_date,
    'last_trade_date', last_trade_date,
    'expiration_date', expiration_date,
    'days_to_first_notice', first_notice_date - CURRENT_DATE,
    'days_to_last_trade', last_trade_date - CURRENT_DATE,
    'is_expired', expiration_date < CURRENT_DATE,
    'needs_attention', first_notice_date - CURRENT_DATE <= 14
  )
  FROM commodity_contract_calendar
  WHERE commodity_id = p_commodity AND contract_month = p_month;
$$ LANGUAGE sql STABLE;
```

### 3.3 Organizations, Users & RBAC

```sql
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  base_currency   VARCHAR(3) DEFAULT 'USD',
  settings        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_settings (
  org_id          UUID PRIMARY KEY,
  default_currency    VARCHAR(3) DEFAULT 'USD',
  reporting_currency  VARCHAR(3) DEFAULT 'USD',
  fiscal_year_start   INT DEFAULT 1,
  date_format         VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  number_format       VARCHAR(20) DEFAULT '1,000.00',
  timezone            VARCHAR(50) DEFAULT 'America/Chicago',
  default_exchange    VARCHAR(20) DEFAULT 'CBOT',
  default_broker      VARCHAR(200),
  default_account     VARCHAR(50),
  commission_default  NUMERIC DEFAULT 0,
  budget_lock_after_approval BOOLEAN DEFAULT false,
  budget_variance_threshold  NUMERIC DEFAULT 10,
  mtm_auto_run        BOOLEAN DEFAULT true,
  mtm_run_time        TIME DEFAULT '16:30',
  position_limit_hard_block BOOLEAN DEFAULT false,
  import_require_approval BOOLEAN DEFAULT true,
  import_auto_template    BOOLEAN DEFAULT true,
  notifications_enabled   BOOLEAN DEFAULT true,
  email_notifications     BOOLEAN DEFAULT true,
  -- Rollover settings
  roll_critical_days      INT DEFAULT 3,
  roll_urgent_days        INT DEFAULT 7,
  roll_upcoming_days      INT DEFAULT 21,
  roll_auto_notify        BOOLEAN DEFAULT true,
  roll_require_approval_critical BOOLEAN DEFAULT true,
  roll_default_target     VARCHAR(20) DEFAULT 'next_active',
  roll_budget_month_policy VARCHAR(20) DEFAULT 'keep_original',
  roll_cost_allocation    VARCHAR(20) DEFAULT 'site',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  role_id         VARCHAR(50) NOT NULL DEFAULT 'viewer',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
  id              VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id              VARCHAR(100) PRIMARY KEY,
  module          VARCHAR(30) NOT NULL,
  action          VARCHAR(30) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id         VARCHAR(50) REFERENCES roles(id),
  permission_id   VARCHAR(100) REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_permission_overrides (
  user_id         UUID NOT NULL,
  permission_id   VARCHAR(100) REFERENCES permissions(id),
  granted         BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

-- Seed roles
INSERT INTO roles (id, name, is_system) VALUES
  ('admin', 'Administrator', true),
  ('trader', 'Trader', true),
  ('risk_manager', 'Risk Manager', true),
  ('operations', 'Operations', true),
  ('viewer', 'Viewer', true);

-- Seed ALL permissions (every plugin)
INSERT INTO permissions (id, module, action) VALUES
  ('trade.create', 'trade', 'create'), ('trade.read', 'trade', 'read'),
  ('trade.update', 'trade', 'update'), ('trade.cancel', 'trade', 'cancel'),
  ('trade.import', 'trade', 'import'),
  ('position.read', 'position', 'read'), ('position.allocate', 'position', 'allocate'),
  ('position.efp', 'position', 'efp'), ('position.offset', 'position', 'offset'),
  ('position.create_physical', 'position', 'create'),
  ('position.roll', 'position', 'roll'), ('position.roll_approve', 'position', 'approve'),
  ('position.roll_cancel', 'position', 'cancel'),
  ('budget.read', 'budget', 'read'), ('budget.create', 'budget', 'create'),
  ('budget.update', 'budget', 'update'), ('budget.submit', 'budget', 'submit'),
  ('budget.approve', 'budget', 'approve'), ('budget.lock', 'budget', 'lock'),
  ('budget.unlock', 'budget', 'unlock'), ('budget.compare', 'budget', 'read'),
  ('risk.read', 'risk', 'read'), ('risk.run_mtm', 'risk', 'execute'),
  ('risk.set_limits', 'risk', 'update'),
  ('market.read', 'market', 'read'), ('market.enter_price', 'market', 'create'),
  ('contract.create', 'contract', 'create'), ('contract.read', 'contract', 'read'),
  ('contract.update', 'contract', 'update'), ('contract.cancel', 'contract', 'cancel'),
  ('logistics.read', 'logistics', 'read'), ('logistics.record_delivery', 'logistics', 'create'),
  ('settlement.read', 'settlement', 'read'), ('settlement.create_invoice', 'settlement', 'create'),
  ('settlement.record_payment', 'settlement', 'update'),
  ('admin.users', 'admin', 'manage'), ('admin.sites', 'admin', 'manage'),
  ('admin.commodities', 'admin', 'manage'), ('admin.roles', 'admin', 'manage'),
  ('admin.org_settings', 'admin', 'manage'), ('admin.site_groups', 'admin', 'manage'),
  ('admin.custom_fields', 'admin', 'manage'), ('admin.import_templates', 'admin', 'manage'),
  ('import.upload', 'import', 'create'), ('import.approve', 'import', 'approve'),
  ('import.reject', 'import', 'delete'),
  ('pricing.read', 'pricing', 'read'), ('pricing.create_formula', 'pricing', 'create'),
  ('pricing.edit_formula', 'pricing', 'update'), ('pricing.manage_rates', 'pricing', 'manage'),
  ('forecast.read', 'forecast', 'read'), ('forecast.create_scenario', 'forecast', 'create'),
  ('forecast.run', 'forecast', 'execute'), ('forecast.stress_test', 'forecast', 'execute'),
  ('dashboard.read', 'dashboard', 'read'), ('dashboard.configure', 'dashboard', 'update'),
  ('dashboard.export', 'dashboard', 'export');

-- Admin gets everything
INSERT INTO role_permissions (role_id, permission_id) SELECT 'admin', id FROM permissions;

-- Trader
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('trader', 'trade.create'), ('trader', 'trade.read'), ('trader', 'trade.update'),
  ('trader', 'trade.import'),
  ('trader', 'position.read'), ('trader', 'position.allocate'),
  ('trader', 'position.efp'), ('trader', 'position.offset'),
  ('trader', 'position.create_physical'), ('trader', 'position.roll'),
  ('trader', 'market.read'), ('trader', 'market.enter_price'),
  ('trader', 'budget.read'), ('trader', 'contract.read'),
  ('trader', 'pricing.read'), ('trader', 'forecast.read'),
  ('trader', 'forecast.create_scenario'), ('trader', 'forecast.run'),
  ('trader', 'dashboard.read'), ('trader', 'dashboard.configure'),
  ('trader', 'import.upload');

-- Risk Manager
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('risk_manager', 'trade.read'), ('risk_manager', 'position.read'),
  ('risk_manager', 'position.roll_approve'),
  ('risk_manager', 'risk.read'), ('risk_manager', 'risk.run_mtm'),
  ('risk_manager', 'risk.set_limits'),
  ('risk_manager', 'market.read'), ('risk_manager', 'budget.read'),
  ('risk_manager', 'contract.read'), ('risk_manager', 'pricing.read'),
  ('risk_manager', 'forecast.read'), ('risk_manager', 'forecast.run'),
  ('risk_manager', 'forecast.stress_test'),
  ('risk_manager', 'dashboard.read'), ('risk_manager', 'dashboard.configure'),
  ('risk_manager', 'import.approve'), ('risk_manager', 'import.reject');

-- Operations
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('operations', 'trade.read'), ('operations', 'position.read'),
  ('operations', 'contract.read'), ('operations', 'contract.create'),
  ('operations', 'contract.update'),
  ('operations', 'logistics.read'), ('operations', 'logistics.record_delivery'),
  ('operations', 'settlement.read'), ('operations', 'settlement.create_invoice'),
  ('operations', 'settlement.record_payment'),
  ('operations', 'budget.read'), ('operations', 'dashboard.read'),
  ('operations', 'import.upload');

-- Viewer gets read-only
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'viewer', id FROM permissions WHERE action = 'read';
```

#### Permission Check Middleware

```javascript
// middleware/permissions.js
async function checkPermission(userId, permissionId) {
  const override = await db.query(
    `SELECT granted FROM user_permission_overrides WHERE user_id = $1 AND permission_id = $2`,
    [userId, permissionId]
  );
  if (override.rows.length > 0) return override.rows[0].granted;
  const result = await db.query(
    `SELECT 1 FROM users u JOIN role_permissions rp ON rp.role_id = u.role_id
     WHERE u.id = $1 AND rp.permission_id = $2`,
    [userId, permissionId]
  );
  return result.rows.length > 0;
}
```

### 3.4 Audit System

```sql
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID, user_id UUID,
  module          VARCHAR(30) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(100) NOT NULL,
  action          VARCHAR(20) NOT NULL,
  changes         JSONB NOT NULL DEFAULT '{}',
  before_snapshot JSONB, after_snapshot JSONB,
  ip_address      INET, user_agent VARCHAR(500),
  source          VARCHAR(30) DEFAULT 'ui',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_module ON audit_log(module, created_at DESC);
```

```javascript
// lib/audit.js — Every plugin calls this on every mutation
async function auditLog({ orgId, userId, module, entityType, entityId, action, before, after, source = 'ui', notes = null }) {
  const changes = {};
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of allKeys) {
    const oldVal = before?.[key] ?? null;
    const newVal = after?.[key] ?? null;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }
  await db.query(
    `INSERT INTO audit_log (org_id, user_id, module, entity_type, entity_id, action, changes, before_snapshot, after_snapshot, source, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [orgId, userId, module, entityType, entityId, action, changes, before, after, source, notes]
  );
}
```

### 3.5 FX Rates

```sql
CREATE TABLE fx_rates (
  id              BIGSERIAL PRIMARY KEY,
  from_currency   VARCHAR(3) NOT NULL,
  to_currency     VARCHAR(3) NOT NULL,
  rate_date       DATE NOT NULL,
  rate            NUMERIC(12,6) NOT NULL,
  source          VARCHAR(50) DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);

CREATE INDEX idx_fx_lookup ON fx_rates(from_currency, to_currency, rate_date DESC);

CREATE OR REPLACE FUNCTION convert_currency(p_amount NUMERIC, p_from VARCHAR, p_to VARCHAR, p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE v_rate NUMERIC; v_rate_date DATE;
BEGIN
  IF p_from = p_to THEN
    RETURN jsonb_build_object('amount', p_amount, 'rate', 1, 'rate_date', p_date, 'is_stale', false);
  END IF;
  SELECT rate, rate_date INTO v_rate, v_rate_date FROM fx_rates
    WHERE from_currency = p_from AND to_currency = p_to AND rate_date <= p_date
    ORDER BY rate_date DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT 1.0/rate, rate_date INTO v_rate, v_rate_date FROM fx_rates
      WHERE from_currency = p_to AND to_currency = p_from AND rate_date <= p_date
      ORDER BY rate_date DESC LIMIT 1;
  END IF;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('amount', null, 'rate', null, 'error', 'No FX rate available');
  END IF;
  RETURN jsonb_build_object('amount', ROUND(p_amount * v_rate, 2), 'rate', v_rate, 'rate_date', v_rate_date, 'is_stale', (p_date - v_rate_date) > 3);
END;
$$ LANGUAGE plpgsql STABLE;
```

### 3.6 Site Types & Sites

**[V1 REFERENCE]:** v1 grouped sites by hardcoded "Canada" and "US" tabs. v2 replaces this with data-driven site groups — regions are defined in the `site_groups` table and the UI dynamically generates tabs/groupings from that data. The tab pattern from v1 is good UX, but the labels and number of tabs must come from the database, not code.

```sql
CREATE TABLE site_types (
  id                    VARCHAR(50) PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  operating_model       VARCHAR(20) NOT NULL,
  supported_commodities TEXT[] NOT NULL,
  features              JSONB NOT NULL DEFAULT '{}',
  position_sections     TEXT[] DEFAULT '{}',
  kpi_config            JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- EXAMPLE site types. Orgs clone + customize these or create new ones via Admin UI.
INSERT INTO site_types (id, name, operating_model, supported_commodities, features, position_sections)
VALUES
  ('grain_elevator', 'Grain Elevator', 'budget',
   '{"CORN","SOYBEAN","WHEAT"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":true,"coverageChart":true,"mtmDashboard":false}',
   '{"hedges","physicals","locked","open_board","all_in_summary"}'),
  ('feed_yard', 'Feed Yard', 'budget',
   '{"CORN","SOYBEAN"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":true,"coverageChart":true,"mtmDashboard":false}',
   '{"hedges","physicals","locked","all_in_summary"}'),
  ('trading_desk', 'Trading Desk', 'margin',
   '{"CORN","SOYBEAN","WHEAT","SOYOIL","SOYMEAL"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":false,"coverageChart":false,"mtmDashboard":true}',
   '{"hedges","physicals","locked","open_board","pnl_summary"}'),
  ('energy_retail', 'Energy Retail', 'margin',
   '{"POWER","NAT_GAS"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":false,"offsetWorkflow":true,"rolloverWorkflow":false,"budgetMonths":false,"coverageChart":false,"mtmDashboard":true,"loadProfiles":true}',
   '{"hedges","supply_contracts","load_profile","pnl_summary"}');

CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  site_type_id    VARCHAR(50) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(20),
  region          VARCHAR(50) NOT NULL,       -- Org-defined: "midwest", "gulf_coast", "alberta", etc. Drives UI grouping.
  timezone        VARCHAR(50) DEFAULT 'America/Chicago',
  is_active       BOOLEAN DEFAULT true,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, group_type VARCHAR(30) NOT NULL,
  parent_id UUID, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_group_members (
  site_group_id UUID NOT NULL, site_id UUID NOT NULL,
  PRIMARY KEY (site_group_id, site_id)
);

CREATE TABLE commodity_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL, commodity_ids TEXT[] NOT NULL,
  sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 Event Bus

```sql
CREATE TABLE event_log (
  id BIGSERIAL PRIMARY KEY, event_type VARCHAR(50) NOT NULL,
  source_module VARCHAR(30) NOT NULL, entity_type VARCHAR(50), entity_id VARCHAR(100),
  payload JSONB NOT NULL DEFAULT '{}', org_id UUID, user_id UUID,
  processed_by TEXT[] DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_type ON event_log(event_type, created_at DESC);
```

```javascript
// lib/eventBus.js
const listeners = {};
async function emit(event) {
  const result = await db.query(
    `INSERT INTO event_log (event_type, source_module, entity_type, entity_id, payload, org_id, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [event.type, event.source, event.entityType, event.entityId, event.payload, event.orgId, event.userId]
  );
  for (const handler of (listeners[event.type] || [])) {
    try { await handler(event); } catch (err) { console.error(`Event handler failed: ${handler.moduleName}`, err); }
  }
}
function on(eventType, moduleName, handler) {
  handler.moduleName = moduleName;
  listeners[eventType] = listeners[eventType] || [];
  listeners[eventType].push(handler);
}
module.exports = { emit, on };
```

### 3.8 Admin Extension Tables

```sql
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL, field_name VARCHAR(50) NOT NULL,
  field_label VARCHAR(100) NOT NULL, field_type VARCHAR(20) NOT NULL,
  options JSONB, is_required BOOLEAN DEFAULT false, default_value TEXT,
  sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, entity_type, field_name)
);

CREATE TABLE custom_field_values (
  id BIGSERIAL PRIMARY KEY, field_def_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL, entity_id UUID NOT NULL,
  value TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_def_id, entity_id)
);

CREATE TABLE user_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
  view_name VARCHAR(200) NOT NULL, view_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL, is_default BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.9 Kernel Helpers

```sql
CREATE OR REPLACE FUNCTION get_commodity(p_id VARCHAR) RETURNS JSONB AS $$
  SELECT jsonb_build_object('id', id, 'name', name, 'category', category, 'unit', unit, 'currency', currency, 'contract_size', contract_size, 'exchange', exchange, 'contract_months', contract_months, 'decimal_places', decimal_places) FROM commodities WHERE id = p_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION site_supports_commodity(p_site_id UUID, p_commodity_id VARCHAR) RETURNS BOOLEAN AS $$
  SELECT p_commodity_id = ANY(st.supported_commodities) FROM sites s JOIN site_types st ON st.id = s.site_type_id WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_operating_model(p_site_id UUID) RETURNS VARCHAR AS $$
  SELECT st.operating_model FROM sites s JOIN site_types st ON st.id = s.site_type_id WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_site_features(p_site_id UUID) RETURNS JSONB AS $$
  SELECT st.features FROM sites s JOIN site_types st ON st.id = s.site_type_id WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;
```

---

## 4. Kernel — AI Import Engine

### 4.1 Tables

```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL, user_id UUID NOT NULL,
  target_module VARCHAR(30) NOT NULL, target_table VARCHAR(50) NOT NULL,
  file_name VARCHAR(500) NOT NULL, file_type VARCHAR(20) NOT NULL,
  file_size BIGINT, file_path VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  ai_model VARCHAR(50), ai_prompt_used TEXT, ai_raw_response TEXT,
  total_rows INT DEFAULT 0, valid_rows INT DEFAULT 0, error_rows INT DEFAULT 0, warning_rows INT DEFAULT 0,
  column_mapping JSONB DEFAULT '{}', validation_summary JSONB DEFAULT '{}',
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_staged_rows (
  id BIGSERIAL PRIMARY KEY, job_id UUID NOT NULL, row_number INT NOT NULL,
  raw_data JSONB NOT NULL, mapped_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  errors JSONB DEFAULT '[]', warnings JSONB DEFAULT '[]',
  ai_corrections JSONB DEFAULT '{}', user_overrides JSONB DEFAULT '{}',
  final_data JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_staged_job ON import_staged_rows(job_id, row_number);

CREATE TABLE import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, target_module VARCHAR(30) NOT NULL, target_table VARCHAR(50) NOT NULL,
  column_mapping JSONB NOT NULL, transforms JSONB DEFAULT '{}', custom_rules JSONB DEFAULT '[]',
  source_description TEXT, sample_headers TEXT[],
  created_by UUID, use_count INT DEFAULT 0, last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 How It Works

Upload file → AI parses structure → AI maps source columns to target schema (with confidence score) → AI validates/corrects each row (C→CORN, Jul26→2026-07, Buy→long, fix dates, strip currency symbols) → User reviews summary (valid/warning/error counts) → User approves → Rows committed to target table → Audit trail recorded.

Templates saved after successful imports. Next upload from same source auto-matches. Duplicate detection on key fields before commit.

### 4.3 Supported Import Targets

Every importable table has a schema defining required fields, optional fields, defaults, and validators. Targets: `tc_financial_trades`, `pm_allocations`, `pm_physical_positions`, `bgt_line_items`, `md_prices`, `ct_physical_contracts`, `lg_deliveries`.

---

## 5. Kernel — Formula Pricing Engine

**[V1 REFERENCE]:** v1 calculates all-in price as financial hedges + physical purchases + gain/loss on closed futures. v2 makes this a proper formula engine so all-in can include basis, freight, elevation, drying, shrink, roll costs — any component.

### 5.1 Tables

```sql
CREATE TABLE pricing_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, description TEXT, commodity_id VARCHAR(20),
  formula_type VARCHAR(30) NOT NULL, components JSONB NOT NULL,
  output_unit VARCHAR(20), rounding INT DEFAULT 4,
  is_active BOOLEAN DEFAULT true, is_system BOOLEAN DEFAULT false,
  created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component types: market_ref, input, calculated, fixed, fx, percentage, lookup

CREATE TABLE pricing_rate_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, rate_type VARCHAR(30) NOT NULL, commodity_id VARCHAR(20),
  rates JSONB NOT NULL, effective_date DATE, expiry_date DATE,
  is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_applied (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), formula_id UUID,
  entity_type VARCHAR(50) NOT NULL, entity_id UUID NOT NULL,
  component_values JSONB NOT NULL, total_price NUMERIC NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD', applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  applied_by UUID, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pricing_applied_entity ON pricing_applied(entity_type, entity_id);
```

### 5.2 Default Templates

Grain All-In (FOB): futures + basis + freight + elevation. Grain Delivered: adds drying + shrink + grade discount. Basis Contract: locked basis + open futures. Energy Fixed: energy + capacity + transmission + ancillary + adder.

### 5.3 Integration with Position Manager

When PM calculates all-in, the pricing engine evaluates: `futures + basis + freight + adjustments + cumulative_roll_cost_per_unit`. Roll costs flow in automatically from the position chain.

---

## 6. Plugin: Trade Capture

**Prefix:** `tc_` · **Depends on:** Kernel · **Step:** 4

```sql
CREATE TABLE tc_financial_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL, trade_type VARCHAR(20) NOT NULL DEFAULT 'futures',
  direction VARCHAR(10) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
  -- Status: open, partially_allocated, fully_allocated, rolled, cancelled

  trade_date DATE NOT NULL, contract_month VARCHAR(10) NOT NULL,
  broker VARCHAR(200), account_number VARCHAR(50),
  num_contracts INT NOT NULL, contract_size NUMERIC NOT NULL,
  total_volume NUMERIC GENERATED ALWAYS AS (num_contracts * contract_size) STORED,
  trade_price NUMERIC NOT NULL, currency VARCHAR(3) DEFAULT 'USD',
  commission NUMERIC DEFAULT 0, fees NUMERIC DEFAULT 0,
  allocated_volume NUMERIC DEFAULT 0,
  unallocated_volume NUMERIC GENERATED ALWAYS AS (num_contracts * contract_size - allocated_volume) STORED,

  option_type VARCHAR(10), strike_price NUMERIC, premium NUMERIC, expiration_date DATE,

  -- Rollover linkage
  rolled_from_id UUID, roll_id UUID,

  entered_by UUID, external_ref VARCHAR(100), notes TEXT, import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_trades_commodity ON tc_financial_trades(commodity_id);
CREATE INDEX idx_tc_trades_status ON tc_financial_trades(status);
CREATE INDEX idx_tc_trades_org ON tc_financial_trades(org_id);
CREATE INDEX idx_tc_trades_month ON tc_financial_trades(contract_month);
```

**Events emitted:** `TRADE_CREATED`, `TRADE_UPDATED`, `TRADE_CANCELLED`
**Events consumed:** `POSITION_ALLOCATED` → update allocated_volume. `POSITION_ROLLED` → update source trade status, link new trade.

---

## 7. Plugin: Position Manager

**Prefix:** `pm_` · **Depends on:** Kernel · **Step:** 2

**[V1 REFERENCE — CRITICAL]:** This is the core of v1. Reference your existing code for ALL of the following:

**Hedge Book:**
- v1 grouped hedges by hardcoded **Canada** and **US** tabs. v2 makes this **fully data-driven**: the hedge book renders tabs/groups dynamically from `site_groups` (type = "region"). If an org has 5 regions, they get 5 tabs. If they have 1, they get 1. Zero hardcoded geography.
- v1 shows **summary of hedge volume** in the hedge book — no granular detail. Keep this.
- v1 does **NOT** allow offset from the hedge book. All trades must be **allocated to a site first** so P&L moves to the correct location. Keep this business rule.
- v1 lets users **assign budget months and sites** from the hedge book. Users can **split trades evenly across budget months/locations** with ability to **override** the split. Keep this UX.
- Allocated trades should remain **visible** in the hedge book (flagged as allocated) so the full portfolio is always represented.

**Site-Level View:**
- v1 shows four sections per site. Keep this layout:
  1. **Hedges Box** — All hedges allocated to the site
  2. **Physical Commitments Box** — All physical purchase/sale commitments
  3. **Open Board View** — If board is open, show hedges weighed against current market price and open volumes. No basis prices in v1, just **open** or **locked price**. v2 can show basis if available.
  4. **All-In Price Summary** — Financial hedges + physical purchases combined into all-in price

**EFP Workflow:**
- v1 handles EFP **behind the scenes**. When user locks a price on an open hedge, the system executes EFP logic: creates sell to close futures, generates buy under locked positions, rolls gain/loss into all-in price. User just sees the hedge move from "open" to "locked". Keep this pattern — no dedicated EFP section on the site view.

**Offset Workflow:**
- v1 only allows offset **from site level** (not hedge book) so P&L stays at the correct location. Keep this.

**All-In Price:**
- v1 calculates: financial hedges + physical purchases + gain/loss on closed futures. v2 extends this with the formula pricing engine (adds basis, freight, roll costs, etc.) but the core concept is the same.

### 7.1 Core Tables

```sql
CREATE TABLE pm_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  trade_id UUID, site_id UUID NOT NULL, commodity_id VARCHAR(20) NOT NULL,
  allocated_volume NUMERIC NOT NULL, budget_month VARCHAR(10),
  allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  -- Status: open, efp_closed, offset, rolled, cancelled

  -- Trade snapshot (so PM works without Trade Capture)
  trade_price NUMERIC NOT NULL, trade_date DATE,
  contract_month VARCHAR(10), direction VARCHAR(10) DEFAULT 'long',
  currency VARCHAR(3) DEFAULT 'USD',

  -- EFP fields
  efp_date DATE, efp_price NUMERIC, efp_volume NUMERIC, futures_pnl NUMERIC,

  -- Offset fields
  offset_date DATE, offset_price NUMERIC, offset_volume NUMERIC, offset_pnl NUMERIC,

  -- Rollover linkage
  rolled_from_allocation_id UUID, roll_id UUID,

  allocated_by UUID, notes TEXT, import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_alloc_site ON pm_allocations(site_id);
CREATE INDEX idx_pm_alloc_trade ON pm_allocations(trade_id);
CREATE INDEX idx_pm_alloc_status ON pm_allocations(status);
CREATE INDEX idx_pm_alloc_commodity ON pm_allocations(commodity_id);

CREATE TABLE pm_locked_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL, site_id UUID NOT NULL, commodity_id VARCHAR(20) NOT NULL,
  volume NUMERIC NOT NULL, locked_price NUMERIC NOT NULL,
  futures_component NUMERIC, basis_component NUMERIC,
  futures_pnl NUMERIC, all_in_price NUMERIC NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  lock_date DATE NOT NULL DEFAULT CURRENT_DATE, delivery_month VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pm_physical_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  site_id UUID NOT NULL, commodity_id VARCHAR(20) NOT NULL, contract_id UUID,
  direction VARCHAR(10) NOT NULL, volume NUMERIC NOT NULL,
  price NUMERIC, pricing_type VARCHAR(20) DEFAULT 'fixed',
  basis_price NUMERIC, basis_month VARCHAR(10),
  delivery_month VARCHAR(10), counterparty VARCHAR(200),
  currency VARCHAR(3) DEFAULT 'USD', status VARCHAR(20) DEFAULT 'open',
  import_job_id UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Rollover Tables

```sql
CREATE TABLE pm_rollovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL, rollover_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  roll_date DATE NOT NULL DEFAULT CURRENT_DATE,
  close_month VARCHAR(10) NOT NULL, close_volume NUMERIC NOT NULL,
  close_price NUMERIC NOT NULL, close_commodity_id VARCHAR(20),
  open_total_volume NUMERIC NOT NULL,
  spread_price NUMERIC, spread_cost NUMERIC, close_realized_pnl NUMERIC,
  direction VARCHAR(10) NOT NULL,
  source_type VARCHAR(30) NOT NULL, source_trade_id UUID, source_allocation_id UUID,
  new_trade_id UUID,
  auto_reallocate BOOLEAN DEFAULT true, reallocation_site_id UUID,
  reallocation_budget_month VARCHAR(10),
  executed_by UUID, approved_by UUID, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pm_rollover_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rollover_id UUID NOT NULL,
  leg_type VARCHAR(10) NOT NULL, commodity_id VARCHAR(20) NOT NULL,
  contract_month VARCHAR(10) NOT NULL, volume NUMERIC NOT NULL,
  price NUMERIC NOT NULL, num_contracts INT,
  trade_id UUID, allocation_id UUID, realized_pnl NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pm_rollover_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rollover_id UUID NOT NULL,
  spread_cost NUMERIC NOT NULL, commission NUMERIC DEFAULT 0, fees NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL, cost_allocation VARCHAR(20) DEFAULT 'site',
  site_id UUID, currency VARCHAR(3) DEFAULT 'USD', created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Position Chain View

```sql
CREATE OR REPLACE VIEW pm_position_chains AS
WITH RECURSIVE chain AS (
  SELECT r.id as rollover_id, r.source_trade_id as original_trade_id,
    r.new_trade_id as current_trade_id, r.close_realized_pnl,
    rc.total_cost as roll_cost, 1 as roll_count,
    r.close_realized_pnl as cumulative_pnl, rc.total_cost as cumulative_roll_cost,
    r.source_allocation_id, r.reallocation_site_id as site_id,
    r.commodity_id, r.direction, r.roll_date, ARRAY[r.id] as roll_chain
  FROM pm_rollovers r LEFT JOIN pm_rollover_costs rc ON rc.rollover_id = r.id
  WHERE r.status = 'executed' AND NOT EXISTS (
    SELECT 1 FROM pm_rollovers prev WHERE prev.new_trade_id = r.source_trade_id AND prev.status = 'executed'
  )
  UNION ALL
  SELECT r.id, chain.original_trade_id, r.new_trade_id, r.close_realized_pnl,
    rc.total_cost, chain.roll_count + 1,
    chain.cumulative_pnl + COALESCE(r.close_realized_pnl, 0),
    chain.cumulative_roll_cost + COALESCE(rc.total_cost, 0),
    r.source_allocation_id, COALESCE(r.reallocation_site_id, chain.site_id),
    r.commodity_id, r.direction, r.roll_date, chain.roll_chain || r.id
  FROM pm_rollovers r JOIN chain ON r.source_trade_id = chain.current_trade_id
  LEFT JOIN pm_rollover_costs rc ON rc.rollover_id = r.id
  WHERE r.status = 'executed'
)
SELECT * FROM chain;
```

### 7.4 Service Logic

```
allocateToSite(tradeId?, siteId, volume, tradePrice, commodityId, ...):
  -- [V1 REFERENCE]: v1 has this workflow. Reference the split logic that lets
  -- users divide trades evenly across budget months/sites with override.
  1. Permission: "position.allocate"
  2. If tradeId + Trade Capture exists: validate unallocated >= volume
  3. Validate site supports commodity (warn, don't block)
  4. Check contract calendar — warn if near expiration
  5. Create pm_allocations with trade snapshot
  6. Audit + emit POSITION_ALLOCATED

executeEFP(allocationId, efpPrice, basisPrice?):
  -- [V1 REFERENCE]: v1 does this behind the scenes. User clicks "lock" on an
  -- open hedge. System creates sell to close futures, buy under locked positions,
  -- rolls gain/loss into all-in price. No visible EFP section on UI.
  1. Permission: "position.efp"
  2. Validate allocation status = "open" (not rolled, not offset)
  3. Block if past last_trade_date (contract calendar)
  4. futures_pnl = (efpPrice - trade_price) × volume × direction_mult
  5. all_in_price = efpPrice + (basisPrice || 0) + cumulative_roll_cost_per_unit
  6. FX convert if needed
  7. Update allocation: status = "efp_closed"
  8. Create pm_locked_positions
  9. Audit + emit EFP_EXECUTED

executeOffset(allocationId, offsetPrice):
  -- [V1 REFERENCE]: v1 only allows offset from site level (not hedge book).
  -- P&L stays at the site. Keep this business rule.
  1. Permission: "position.offset"
  2. Validate allocation status = "open"
  3. Block if past last_trade_date
  4. offset_pnl = (offsetPrice - trade_price) × volume × direction_mult
  5. Update allocation: status = "offset"
  6. Audit + emit POSITION_OFFSET

executeRoll(params):
  -- NEW in v2 — no v1 reference
  1. Permission: "position.roll"
  2. Validate source (trade or allocation), status = "open"
  3. Block if past last_trade_date on close month
  4. Calculate: close_realized_pnl, spread_cost, total_roll_cost
  5. Create pm_rollovers record + legs
  6. Close leg: update source status = "rolled"
  7. Open leg: create new tc_financial_trades
  8. Auto-reallocation if site-allocated + autoReallocate
  9. Budget month: apply org_settings.roll_budget_month_policy
  10. Roll costs: create pm_rollover_costs
  11. Audit + emit POSITION_ROLLED

getRolloverCandidates(orgId):
  1. Fetch open positions, check contract calendar
  2. Categorize: CRITICAL (≤3d), URGENT (≤7d), UPCOMING (≤21d)
  3. Thresholds from org_settings

getSitePosition(siteId, commodity?):
  -- [V1 REFERENCE]: v1 has the 4-section site view layout. Keep it.
  -- v2 adds: contract calendar warnings, roll cost inclusion, formula pricing.
  1. Get site features from kernel
  2. Fetch allocations, physicals, locked positions
  3. Check contract calendar for deadlines
  4. Get cumulative roll costs from pm_position_chains
  5. If Market Data exists: get prices for open board
  6. If Market Data missing: show "—"
  7. Calculate all-in via pricing engine (includes roll costs)
  8. Return sections based on site_type.position_sections
```

### 7.5 Fallback Behavior

| Dependency | If Missing | Behavior |
|-----------|-----------|----------|
| Trade Capture | No trades to allocate | Manual position entry with snapshot fields |
| Market Data | No live prices | Open board shows "—", no MTM |
| Budget | No coverage context | All-in price works, coverage chart hidden |

---

## 8. Plugin: Budget (Enhanced)

**Prefix:** `bgt_` · **Depends on:** Kernel · **Step:** 6

**[V1 REFERENCE]:** v1 has coverage charts (stacked bar: hedged + committed + open vs budget target) and Budget vs Committed charts with toggle functionality. Reference the chart layout and toggle UX. v2 adds: approval workflow, versioning, and cross-budget comparisons.

```sql
CREATE TABLE bgt_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  site_id UUID NOT NULL, commodity_id VARCHAR(20) NOT NULL, budget_year INT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  approved_by UUID, approved_at TIMESTAMPTZ, locked_at TIMESTAMPTZ,
  notes TEXT, import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, commodity_id, budget_year)
);

CREATE TABLE bgt_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), period_id UUID NOT NULL,
  budget_month VARCHAR(10) NOT NULL,
  budgeted_volume NUMERIC NOT NULL, budget_price NUMERIC,
  budget_cost NUMERIC GENERATED ALWAYS AS (budgeted_volume * COALESCE(budget_price, 0)) STORED,
  committed_volume NUMERIC DEFAULT 0, committed_avg_price NUMERIC, committed_cost NUMERIC DEFAULT 0,
  hedged_volume NUMERIC DEFAULT 0, hedged_avg_price NUMERIC, hedged_cost NUMERIC DEFAULT 0,
  total_covered_volume NUMERIC GENERATED ALWAYS AS (committed_volume + hedged_volume) STORED,
  coverage_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN budgeted_volume > 0 THEN (committed_volume + hedged_volume) / budgeted_volume * 100 ELSE 0 END
  ) STORED,
  open_volume NUMERIC GENERATED ALWAYS AS (GREATEST(budgeted_volume - committed_volume - hedged_volume, 0)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, budget_month)
);

CREATE TABLE bgt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), period_id UUID NOT NULL,
  version_number INT NOT NULL, version_name VARCHAR(100),
  snapshot JSONB NOT NULL, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, version_number)
);

CREATE TABLE bgt_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, description TEXT,
  comparison_items JSONB NOT NULL, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Events consumed:** `POSITION_ALLOCATED` → update hedged_volume. `PHYSICAL_POSITION_CREATED` → update committed_volume. `POSITION_ROLLED` → if budget month changed, move hedged volume between months.

---

## 9. Plugin: Market Data

**Prefix:** `md_` · **Depends on:** Kernel · **Step:** 5

```sql
CREATE TABLE md_prices (
  id BIGSERIAL PRIMARY KEY, commodity_id VARCHAR(20) NOT NULL,
  contract_month VARCHAR(10) NOT NULL, price_date DATE NOT NULL,
  price_type VARCHAR(20) NOT NULL DEFAULT 'settlement',
  price NUMERIC NOT NULL, open_price NUMERIC, high_price NUMERIC, low_price NUMERIC,
  volume BIGINT, open_interest BIGINT,
  source VARCHAR(50) DEFAULT 'manual', import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, contract_month, price_date, price_type)
);
CREATE INDEX idx_md_prices_lookup ON md_prices(commodity_id, contract_month, price_date DESC);

CREATE TABLE md_forward_curves (
  id BIGSERIAL PRIMARY KEY, commodity_id VARCHAR(20) NOT NULL,
  curve_date DATE NOT NULL, contract_month VARCHAR(10) NOT NULL,
  price NUMERIC NOT NULL, source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, curve_date, contract_month)
);
```

**Events emitted:** `PRICE_UPDATED`

---

## 10. Plugin: Risk

**Prefix:** `rsk_` · **Depends on:** Kernel · **Step:** 10

```sql
CREATE TABLE rsk_mtm_snapshots (
  id BIGSERIAL PRIMARY KEY, org_id UUID NOT NULL, snapshot_date DATE NOT NULL,
  commodity_id VARCHAR(20) NOT NULL,
  open_futures_volume NUMERIC, futures_mtm_pnl NUMERIC,
  open_physical_volume NUMERIC, physical_mtm_pnl NUMERIC,
  net_position_volume NUMERIC, total_mtm_pnl NUMERIC,
  realized_pnl NUMERIC, roll_costs_included NUMERIC DEFAULT 0,
  market_price_used NUMERIC, currency VARCHAR(3) DEFAULT 'USD',
  source VARCHAR(20) DEFAULT 'auto', created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, snapshot_date, commodity_id)
);

CREATE TABLE rsk_position_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  commodity_id VARCHAR(20), limit_type VARCHAR(30) NOT NULL,
  limit_value NUMERIC NOT NULL, unit VARCHAR(20) NOT NULL,
  alert_threshold NUMERIC DEFAULT 80, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Plugins: Contracts, Logistics, Settlement

### Contracts (`ct_`) — Step 10

```sql
CREATE TABLE ct_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, type VARCHAR(20), contact_info JSONB DEFAULT '{}',
  payment_terms VARCHAR(50), credit_limit NUMERIC, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ct_physical_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL, site_id UUID,
  commodity_id VARCHAR(20) NOT NULL, counterparty_id UUID, counterparty_name VARCHAR(200),
  contract_type VARCHAR(20) NOT NULL, pricing_type VARCHAR(20) DEFAULT 'fixed',
  status VARCHAR(20) DEFAULT 'active', contract_date DATE NOT NULL,
  delivery_start DATE, delivery_end DATE,
  total_volume NUMERIC NOT NULL, delivered_volume NUMERIC DEFAULT 0,
  remaining_volume NUMERIC GENERATED ALWAYS AS (total_volume - delivered_volume) STORED,
  unit VARCHAR(20) NOT NULL, fixed_price NUMERIC, basis_price NUMERIC, basis_month VARCHAR(10),
  pricing_formula_id UUID, freight_terms VARCHAR(50), quality_specs JSONB DEFAULT '{}',
  currency VARCHAR(3) DEFAULT 'USD', contract_ref VARCHAR(100), notes TEXT,
  attachments JSONB DEFAULT '[]', import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Logistics (`lg_`) — Step 12

```sql
CREATE TABLE lg_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL, site_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL, contract_id UUID,
  delivery_date DATE NOT NULL, volume NUMERIC NOT NULL, unit VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled', carrier VARCHAR(200), vehicle_id VARCHAR(50),
  origin VARCHAR(200), destination VARCHAR(200), freight_cost NUMERIC,
  quality_results JSONB DEFAULT '{}', weight_ticket VARCHAR(50),
  notes TEXT, import_job_id UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lg_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), site_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL, as_of_date DATE NOT NULL,
  on_hand_volume NUMERIC NOT NULL, committed_out NUMERIC DEFAULT 0,
  available NUMERIC GENERATED ALWAYS AS (on_hand_volume - committed_out) STORED,
  unit VARCHAR(20) NOT NULL, avg_cost NUMERIC, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, commodity_id, as_of_date)
);
```

### Settlement (`stl_`) — Step 12

```sql
CREATE TABLE stl_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  counterparty_id UUID, counterparty_name VARCHAR(200),
  invoice_type VARCHAR(20) NOT NULL, status VARCHAR(20) DEFAULT 'draft',
  invoice_number VARCHAR(50), invoice_date DATE DEFAULT CURRENT_DATE, due_date DATE,
  subtotal NUMERIC NOT NULL, tax NUMERIC DEFAULT 0, freight NUMERIC DEFAULT 0,
  adjustments NUMERIC DEFAULT 0, total NUMERIC NOT NULL, currency VARCHAR(3) DEFAULT 'USD',
  line_items JSONB NOT NULL DEFAULT '[]',
  payment_date DATE, payment_ref VARCHAR(100), notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 12. Plugin: Forecast

**Prefix:** `fct_` · **Depends on:** Kernel · **Step:** 11

```sql
CREATE TABLE fct_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL, description TEXT, scenario_type VARCHAR(30) NOT NULL,
  base_date DATE DEFAULT CURRENT_DATE, base_commodity VARCHAR(20), base_site_id UUID,
  assumptions JSONB NOT NULL, results JSONB,
  status VARCHAR(20) DEFAULT 'draft', created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fct_scenario_results (
  id BIGSERIAL PRIMARY KEY, scenario_id UUID NOT NULL,
  site_id UUID, commodity_id VARCHAR(20) NOT NULL,
  current_coverage_pct NUMERIC, current_all_in_price NUMERIC,
  current_mtm_pnl NUMERIC, current_open_volume NUMERIC,
  projected_coverage_pct NUMERIC, projected_all_in_price NUMERIC,
  projected_mtm_pnl NUMERIC, projected_open_volume NUMERIC,
  coverage_change NUMERIC, price_change NUMERIC, pnl_change NUMERIC, volume_change NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Scenario types:** price_move, volume_change, what_if (simulate hedges/EFPs), stress_test (multiple scenarios).

---

## 13. Plugin: Energy

**Prefix:** `nrg_` · **Depends on:** Kernel · **Step:** 13

```sql
-- EXAMPLE energy commodities. Added via Admin UI when energy plugin is enabled.
INSERT INTO commodities (id, name, category, unit, currency, exchange, contract_months, config) VALUES
  ('POWER', 'Electric Power', 'energy', 'MWh', 'USD', NULL, 'FGHJKMNQUVXZ',
   '{"iso_regions":["ERCOT","PJM","ISO_NE","MISO"]}'),
  ('NAT_GAS', 'Natural Gas', 'energy', 'MMBtu', 'USD', 'NYMEX', 'FGHJKMNQUVXZ',
   '{"contract_size":10000}');

CREATE TABLE nrg_load_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), site_id UUID NOT NULL,
  profile_type VARCHAR(20) NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL,
  hourly_data JSONB NOT NULL, peak_volume NUMERIC, off_peak_volume NUMERIC,
  total_volume NUMERIC, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nrg_contract_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contract_id UUID NOT NULL,
  product_type VARCHAR(30) NOT NULL, iso_region VARCHAR(20) NOT NULL, zone VARCHAR(50),
  energy_rate NUMERIC, capacity_rate NUMERIC, transmission_rate NUMERIC,
  ancillary_rate NUMERIC, adder NUMERIC, block_volume NUMERIC, block_price NUMERIC,
  index_source VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 14. Complete Event Catalog

| Event | Source | Listeners | Payload |
|-------|--------|-----------|---------|
| `TRADE_CREATED` | Trade Capture | Position Manager | tradeId, commodityId, volume, price, contractMonth |
| `TRADE_UPDATED` | Trade Capture | Position Manager | tradeId, changedFields |
| `TRADE_CANCELLED` | Trade Capture | Position Manager | tradeId, reason |
| `POSITION_ALLOCATED` | Position Manager | Trade Capture, Budget | allocationId, tradeId, siteId, commodityId, volume, budgetMonth |
| `POSITION_DEALLOCATED` | Position Manager | Trade Capture, Budget | allocationId, tradeId, volume |
| `EFP_EXECUTED` | Position Manager | Trade Capture, Risk | allocationId, siteId, commodityId, pnl, allInPrice |
| `POSITION_OFFSET` | Position Manager | Trade Capture, Risk | allocationId, siteId, commodityId, pnl |
| `POSITION_ROLLED` | Position Manager | Trade Capture, Budget, Risk | rolloverId, sourceType, sourceId, closeMonth, openMonths[], pnl, spreadCost, siteId?, newTradeIds[] |
| `ROLL_DEADLINE_WARNING` | Position Manager | Dashboard | allocationId, commodityId, contractMonth, daysRemaining, severity |
| `PHYSICAL_POSITION_CREATED` | Position Manager | Budget | positionId, siteId, commodityId, volume, deliveryMonth |
| `PHYSICAL_CONTRACT_CREATED` | Contracts | Position Manager, Budget | contractId, siteId, commodityId, volume, price |
| `DELIVERY_RECORDED` | Logistics | Contracts, Settlement | deliveryId, contractId, siteId, volume |
| `PRICE_UPDATED` | Market Data | Position Manager, Risk | commodityId, contractMonth, price |
| `MTM_CALCULATED` | Risk | Dashboard | orgId, date, totalPnl |
| `LIMIT_BREACHED` | Risk | Dashboard | orgId, commodityId, limitType, currentValue |
| `IMPORT_COMMITTED` | AI Import | Target module | jobId, targetTable, rowCount |

---

## 15. Charts & KPIs

**[V1 REFERENCE]:** v1 has working coverage charts (stacked bars) and Budget vs Committed charts with toggle. Reference the v1 chart components and dark theme styling for all charts.

### KPI Cards (auto-selected by operating model)

**Budget model:** Coverage %, Budgeted Volume, Hedged Volume, Committed Volume, Open Volume, Budget VWAP, Actual VWAP, Budget Variance
**Margin model:** Total MTM P&L, Realized P&L, Unrealized P&L, Net Position
**Universal:** Open Trades, Unallocated Volume, Expiring Positions (14d), Active Contracts

### Chart Components

| Chart | Type | Where |
|-------|------|-------|
| Coverage by Month | Stacked bar | Dashboard, Budget, Site |
| Coverage % Gauge | Gauge | Dashboard, Site |
| Budget vs Actual Price | Grouped bar | Dashboard, Budget |
| All-In Cost Waterfall | Waterfall | Site, Reports |
| Position by Month | Stacked bar | Hedge Book, Site |
| Position Lifecycle Funnel | Funnel | Dashboard, Hedge Book |
| Daily P&L Trend | Area | Dashboard, Risk |
| P&L by Commodity | Horizontal bar | Dashboard, Risk |
| Price History | Candlestick | Market Data, Site |
| Forward Curve | Line | Market Data, Risk |
| Basis History | Line | Market Data, Site |
| Exposure by Tenor | Bar | Risk, Dashboard |
| Counterparty Exposure | Treemap | Risk |
| Position Limit Usage | Bullet | Dashboard, Risk |
| Delivery Calendar | Calendar heatmap | Logistics, Site |
| Inventory Trend | Area | Site, Logistics |
| Scenario Comparison | Multi-line | Forecast, Dashboard |
| Sensitivity Tornado | Tornado | Forecast |
| Roll History Timeline | Timeline | Position Detail |
| Expiring Positions | Alert list | Dashboard, Position Manager |

Dashboards configurable per user via `crt_dashboards` table.

```sql
CREATE TABLE crt_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, org_id UUID NOT NULL,
  name VARCHAR(200) DEFAULT 'My Dashboard', layout JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 16. Admin UI Screens

```
Admin
├── Organization Settings
│   ├── General: name, currency, timezone, date/number format
│   ├── Trading Defaults: exchange, broker, account, commission
│   ├── Budget Settings: lock after approval, variance threshold
│   ├── Risk Settings: auto MTM timing, limit enforcement
│   ├── Rollover Settings: deadline thresholds, approval rules, budget month policy
│   └── Import Settings: require approval, auto-template
├── Commodities
│   ├── Commodity List (with status toggle)
│   ├── Add/Edit Commodity
│   ├── Contract Calendar (expiration dates per month)
│   ├── Commodity Groups
│   └── Pricing Formulas (builder + rate tables)
├── Sites
│   ├── Site List (filterable)
│   ├── Add Site Wizard (type → name/region → groups → features → budgets)
│   ├── Edit Site
│   ├── Site Groups (region, division, portfolio)
│   └── Site Type Manager
├── Users & Roles
│   ├── User List
│   ├── Add/Edit User (role, site access)
│   ├── Role Manager (permission matrix)
│   └── Permission Overrides
├── Counterparties
├── Custom Fields
├── Import Templates
└── System (Audit Log, Event Log, FX Rates, Data Export)
```

---

## 17. Dependency Matrix

```
                  Kernel  TradeCap  PosMgr  Budget  Risk  MktData  Contracts  Logistics  Settlement  Forecast  Energy
Trade Capture     REQ     —         —       —       —     —        —          —          —           —         —
Position Manager  REQ     OPT       —       —       —     OPT      —          —          —           —         —
Budget            REQ     —         OPT     —       —     —        OPT        —          —           —         —
Risk              REQ     OPT       OPT     —       —     OPT      —          —          —           —         —
Market Data       REQ     —         —       —       —     —        —          —          —           —         —
Contracts         REQ     —         —       —       —     —        —          —          —           —         —
Logistics         REQ     —         —       —       —     —        OPT        —          —           —         —
Settlement        REQ     —         —       —       —     —        OPT        OPT        —           —         —
Forecast          REQ     —         OPT     OPT     OPT   OPT      —          —          —           —         —
Energy            REQ     —         OPT     —       —     —        OPT        —          —           —         —
```

---

## 18. Build Order

| Step | Module | Est. | After This Step | V1 Reference |
|------|--------|------|-----------------|-------------|
| 1 | **Kernel** | ~4 hrs | Database, auth, RBAC, audit, FX, calendar, event bus | None — all new |
| 2 | **Position Manager** | ~2 days | Core product: hedge book, site views, EFP, offset, rollover | **HEAVY** — reference v1 hedge book layout (make region tabs data-driven, not hardcoded), 4-section site view, EFP-behind-the-scenes, offset-from-site-only, allocation split UX, all-in price calc |
| 3 | **AI Import Engine** | ~1 day | Bulk upload positions, trades, budgets from spreadsheets | None — all new |
| 4 | **Trade Capture** | ~1 day | Trades feed PM. Import works for trade files. | None — v1 had manual entry embedded in PM |
| 5 | **Market Data** | ~0.5 day | Open board shows market comparison | Partial — v1 had open board concept but no formal market data |
| 6 | **Budget** | ~1 day | Full budget lifecycle. Coverage tracking. | **MODERATE** — reference v1 coverage charts (stacked bars), budget vs committed toggle |
| 7 | **Formula Pricing** | ~1 day | Real all-in: futures + basis + freight + roll costs | Partial — v1 had simpler all-in calc, v2 extends it |
| 8 | **Admin UI** | ~2 days | System is manageable. Multi-site setup. | None — all new |
| 9 | **Charts & Dashboard** | ~2 days | Visual analytics across all modules | **MODERATE** — reference v1 chart components, dark theme, KPI layout |
| 10 | **Contracts + Risk** | ~2 days | Contract lifecycle, MTM engine, limits | None — all new |
| 11 | **Forecasting** | ~1 day | What-if analysis, sensitivity, stress tests | None — all new |
| 12 | **Logistics + Settlement** | ~2 days | Deliveries, inventory, invoicing, payments | None — all new |
| 13 | **Energy** | ~2 days | Energy commodities, load profiles, ISO pricing | None — all new |

**Total: ~18-20 working days for full system.**

### How to Use V1 References in Claude Code

When you reach a step with a V1 reference, tell Claude Code:

> "Before building this, look at the v1 implementation in [directory]. The UI layout, color scheme, and user workflow should match what's already there. The data model and API layer are completely new (use the schemas from the master design), but the frontend should feel like a polished version of v1."

For steps with no V1 reference, you can go straight from the master design.

---

## 19. Naming Conventions

| Convention | Example | Why |
|-----------|---------|-----|
| Table prefix by plugin | `tc_`, `pm_`, `bgt_`, `rsk_`, `md_`, `ct_`, `lg_`, `stl_`, `nrg_`, `fct_`, `crt_` | Know which module owns what |
| Kernel tables: no prefix | `commodities`, `sites`, `users`, `audit_log` | Shared foundation |
| Soft refs: UUID, no FK | `trade_id UUID` | Cross-module decoupling |
| Denormalized fallbacks | `counterparty_name` alongside `counterparty_id` | Works if source plugin missing |
| Events: SCREAMING_SNAKE | `TRADE_CREATED`, `POSITION_ROLLED` | Easy to grep |
| Permissions: module.action | `position.efp`, `position.roll` | Hierarchical, scannable |
| Config: JSONB | `features JSONB` | Extensible without migrations |
| All money: NUMERIC | Never FLOAT or DOUBLE | Financial precision |
| All timestamps: TIMESTAMPTZ | Never TIMESTAMP | Timezone-safe |
| Import link: import_job_id | On every importable table | Trace data lineage |
| Roll link: roll_id, rolled_from_* | On trades and allocations | Trace position chain |
