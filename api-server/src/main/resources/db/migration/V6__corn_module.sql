-- =============================================================================
-- V6: Corn Procurement Module
-- Sites, budget lines, hedge trades, allocations, physical contracts,
-- EFP tickets, receipt tickets, daily settle prices
-- =============================================================================

-- ── Sites ─────────────────────────────────────────────────────────────────────

CREATE TABLE corn_sites (
    id          BIGSERIAL    PRIMARY KEY,
    code        VARCHAR(10)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    country     VARCHAR(50),
    province    VARCHAR(50),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100)
);

INSERT INTO corn_sites (code, name, country, province, created_at, created_by) VALUES
    ('GM1', 'Gimli',       'Canada', 'MB', NOW(), 'system'),
    ('VF1', 'Valleyfield', 'Canada', 'QC', NOW(), 'system');

-- ── Site Budgets (legacy — used by SiteBudget entity) ─────────────────────────

CREATE TABLE corn_site_budgets (
    id                  BIGSERIAL      PRIMARY KEY,
    site_id             BIGINT         NOT NULL REFERENCES corn_sites(id),
    delivery_month      VARCHAR(7)     NOT NULL,
    budget_volume_mt    NUMERIC(12,4),
    budget_price_per_mt NUMERIC(10,4),
    budget_basis_per_mt NUMERIC(10,4),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100)
);

-- ── Budget Lines ──────────────────────────────────────────────────────────────

CREATE TABLE corn_budget_lines (
    id                BIGSERIAL      PRIMARY KEY,
    site_id           BIGINT         NOT NULL REFERENCES corn_sites(id),
    commodity_code    VARCHAR(20)    NOT NULL DEFAULT 'CORN-ZC',
    budget_month      VARCHAR(7)     NOT NULL,
    futures_month     VARCHAR(10),
    budget_volume_mt  NUMERIC(14,4),
    budget_volume_bu  NUMERIC(16,2),
    crop_year         VARCHAR(10),
    notes             VARCHAR(500),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ,
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100)
);

CREATE INDEX idx_budget_lines_site_month ON corn_budget_lines (site_id, budget_month);

-- ── Budget Components ─────────────────────────────────────────────────────────

CREATE TABLE corn_budget_components (
    id              BIGSERIAL      PRIMARY KEY,
    budget_line_id  BIGINT         NOT NULL REFERENCES corn_budget_lines(id) ON DELETE CASCADE,
    component_name  VARCHAR(100)   NOT NULL,
    unit            VARCHAR(20)    NOT NULL DEFAULT '$/MT',
    target_value    NUMERIC(12,4)  NOT NULL,
    display_order   INTEGER,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100)
);

-- ── Hedge Trades ──────────────────────────────────────────────────────────────

CREATE TABLE corn_hedge_trades (
    id              BIGSERIAL      PRIMARY KEY,
    trade_ref       VARCHAR(50)    NOT NULL UNIQUE,
    futures_month   VARCHAR(10),
    lots            INTEGER,
    price_per_bushel NUMERIC(10,4),
    broker_account  VARCHAR(100),
    trade_date      DATE,
    status          VARCHAR(30)    NOT NULL DEFAULT 'OPEN',
    open_lots       INTEGER,
    book            VARCHAR(10),   -- CANADA or US
    notes           TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100)
);

-- ── Hedge Allocations ─────────────────────────────────────────────────────────

CREATE TABLE corn_hedge_allocations (
    id              BIGSERIAL   PRIMARY KEY,
    hedge_trade_id  BIGINT      NOT NULL REFERENCES corn_hedge_trades(id),
    site_id         BIGINT      NOT NULL REFERENCES corn_sites(id),
    budget_month    VARCHAR(7)  NOT NULL,
    allocated_lots  INTEGER     NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    CONSTRAINT uq_hedge_alloc UNIQUE (hedge_trade_id, site_id, budget_month)
);

-- ── Physical Contracts ────────────────────────────────────────────────────────

CREATE TABLE corn_physical_contracts (
    id                    BIGSERIAL      PRIMARY KEY,
    contract_ref          VARCHAR(50)    NOT NULL UNIQUE,
    site_id               BIGINT         NOT NULL REFERENCES corn_sites(id),
    supplier_name         VARCHAR(200),
    commodity_code        VARCHAR(20)    DEFAULT 'CORN-ZC',
    quantity_mt           NUMERIC(12,4)  NOT NULL,
    delivery_month        VARCHAR(7),
    basis_cents_bu        NUMERIC(10,4),
    freight_per_mt        NUMERIC(10,4),
    currency              VARCHAR(5)     DEFAULT 'USD',
    futures_ref           VARCHAR(10),
    status                VARCHAR(30)    NOT NULL DEFAULT 'OPEN',
    board_price_cents_bu  NUMERIC(10,4),
    basis_locked_date     DATE,
    contract_date         DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ,
    created_by            VARCHAR(100),
    updated_by            VARCHAR(100)
);

CREATE INDEX idx_physical_contracts_site ON corn_physical_contracts (site_id);
CREATE INDEX idx_physical_contracts_delivery ON corn_physical_contracts (delivery_month);

-- ── EFP Tickets ───────────────────────────────────────────────────────────────

CREATE TABLE corn_efp_tickets (
    id                   BIGSERIAL     PRIMARY KEY,
    ticket_ref           VARCHAR(50)   NOT NULL UNIQUE,
    hedge_trade_id       BIGINT        NOT NULL REFERENCES corn_hedge_trades(id),
    physical_contract_id BIGINT        NOT NULL REFERENCES corn_physical_contracts(id),
    lots                 INTEGER,
    futures_month        VARCHAR(10),
    board_price          NUMERIC(10,4),
    basis_value          NUMERIC(10,4),
    quantity_mt          NUMERIC(12,4),
    efp_date             DATE,
    confirmation_ref     VARCHAR(100),
    status               VARCHAR(30)   NOT NULL DEFAULT 'CONFIRMED',
    notes                TEXT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100)
);

-- ── Receipt Tickets ───────────────────────────────────────────────────────────

CREATE TABLE corn_receipt_tickets (
    id                   BIGSERIAL     PRIMARY KEY,
    ticket_ref           VARCHAR(50)   NOT NULL UNIQUE,
    physical_contract_id BIGINT        NOT NULL REFERENCES corn_physical_contracts(id),
    site_id              BIGINT        NOT NULL REFERENCES corn_sites(id),
    receipt_date         DATE,
    gross_mt             NUMERIC(12,4),
    net_mt               NUMERIC(12,4),
    moisture_pct         NUMERIC(6,2),
    shrink_factor        NUMERIC(6,4),
    net_bushels          NUMERIC(12,4),
    delivered_cost_per_mt NUMERIC(10,4),
    total_cost_usd       NUMERIC(14,2),
    vehicle_ref          VARCHAR(100),
    notes                TEXT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100)
);

-- ── Daily Settle Prices ───────────────────────────────────────────────────────

CREATE TABLE corn_daily_settles (
    id               BIGSERIAL     PRIMARY KEY,
    futures_month    VARCHAR(10)   NOT NULL,
    settle_date      DATE          NOT NULL,
    price_per_bushel NUMERIC(10,4) NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    CONSTRAINT uq_settle UNIQUE (futures_month, settle_date)
);
