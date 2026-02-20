-- ============================================================
-- HedgeLab CTRM Platform — Initial Schema
-- V1: All core tables matching JPA entity annotations
-- ============================================================

-- ── Sequences ──────────────────────────────────────────────
CREATE SEQUENCE commodity_id_seq     START 1 INCREMENT 1;
CREATE SEQUENCE counterparty_id_seq  START 1 INCREMENT 1;
CREATE SEQUENCE book_id_seq          START 1 INCREMENT 1;
CREATE SEQUENCE price_index_id_seq   START 1 INCREMENT 1;
CREATE SEQUENCE daily_price_id_seq   START 1 INCREMENT 1;
CREATE SEQUENCE fwd_curve_id_seq     START 1 INCREMENT 1;
CREATE SEQUENCE formula_id_seq       START 1 INCREMENT 1;
CREATE SEQUENCE formula_comp_id_seq  START 1 INCREMENT 1;
CREATE SEQUENCE trade_id_seq         START 1 INCREMENT 1;
CREATE SEQUENCE delivery_id_seq      START 1 INCREMENT 1;
CREATE SEQUENCE position_id_seq      START 1 INCREMENT 1;
CREATE SEQUENCE mtm_id_seq           START 1 INCREMENT 1;
CREATE SEQUENCE pnl_id_seq           START 1 INCREMENT 1;
CREATE SEQUENCE risk_id_seq          START 1 INCREMENT 1;
CREATE SEQUENCE credit_util_id_seq   START 1 INCREMENT 1;
CREATE SEQUENCE invoice_id_seq       START 1 INCREMENT 1;
CREATE SEQUENCE payment_id_seq       START 1 INCREMENT 1;

-- ── commodities ────────────────────────────────────────────
CREATE TABLE commodities (
    id              BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('commodity_id_seq'),
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(30) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    currency        VARCHAR(3)  NOT NULL,
    hedgeable       BOOLEAN     NOT NULL DEFAULT false,
    active          BOOLEAN     NOT NULL DEFAULT true,
    description     VARCHAR(500),
    icis_code       VARCHAR(30),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    CONSTRAINT uq_commodity_code UNIQUE (code)
);

-- ── counterparties ─────────────────────────────────────────
CREATE TABLE counterparties (
    id                   BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('counterparty_id_seq'),
    legal_entity_code    VARCHAR(30)  NOT NULL,
    lei                  VARCHAR(20),
    short_name           VARCHAR(50)  NOT NULL,
    full_legal_name      VARCHAR(200) NOT NULL,
    type                 VARCHAR(25)  NOT NULL,
    status               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    credit_rating        VARCHAR(10),
    credit_limit_usd     NUMERIC(22,2) DEFAULT 0.00,
    current_exposure_usd NUMERIC(22,2) DEFAULT 0.00,
    country              VARCHAR(2),
    registration_number  VARCHAR(50),
    contact_email        VARCHAR(150),
    contact_phone        VARCHAR(30),
    onboarded_date       DATE,
    last_review_date     DATE,
    internal_notes       VARCHAR(2000),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    CONSTRAINT uq_cp_code       UNIQUE (legal_entity_code),
    CONSTRAINT uq_cp_short_name UNIQUE (short_name)
);

-- ── books ──────────────────────────────────────────────────
CREATE TABLE books (
    id           BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('book_id_seq'),
    book_code    VARCHAR(20) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    trading_desk VARCHAR(50),
    description  VARCHAR(500),
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE,
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    CONSTRAINT uq_book_code UNIQUE (book_code)
);

-- ── price_indices ──────────────────────────────────────────
CREATE TABLE price_indices (
    id           BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('price_index_id_seq'),
    index_code   VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    commodity_id BIGINT      NOT NULL REFERENCES commodities(id),
    provider     VARCHAR(50),
    currency     VARCHAR(3)  NOT NULL,
    unit         VARCHAR(20),
    active       BOOLEAN     NOT NULL DEFAULT true,
    description  VARCHAR(500),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE,
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    CONSTRAINT uq_index_code UNIQUE (index_code)
);

-- ── daily_prices ───────────────────────────────────────────
CREATE TABLE daily_prices (
    id             BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('daily_price_id_seq'),
    price_index_id BIGINT      NOT NULL REFERENCES price_indices(id),
    price_date     DATE        NOT NULL,
    price          NUMERIC(20,6) NOT NULL,
    price_type     VARCHAR(10) NOT NULL DEFAULT 'SETTLE',
    source         VARCHAR(50),
    confirmed      BOOLEAN     NOT NULL DEFAULT true,
    published_at   TIMESTAMP WITH TIME ZONE,
    created_by     VARCHAR(100),
    CONSTRAINT uq_daily_price UNIQUE (price_index_id, price_date, price_type)
);

CREATE INDEX idx_daily_prices_index_date ON daily_prices (price_index_id, price_date);

-- ── forward_curve_points ───────────────────────────────────
CREATE TABLE forward_curve_points (
    id             BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('fwd_curve_id_seq'),
    price_index_id BIGINT      NOT NULL REFERENCES price_indices(id),
    curve_date     DATE        NOT NULL,
    delivery_month VARCHAR(7)  NOT NULL,
    forward_price  NUMERIC(20,6) NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_fwd_curve UNIQUE (price_index_id, curve_date, delivery_month)
);

CREATE INDEX idx_fwd_curve_index_date ON forward_curve_points (price_index_id, curve_date);

-- ── price_formulas ─────────────────────────────────────────
CREATE TABLE price_formulas (
    id           BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('formula_id_seq'),
    formula_code VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description  VARCHAR(500),
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE,
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    CONSTRAINT uq_formula_code UNIQUE (formula_code)
);

-- ── formula_components ─────────────────────────────────────
CREATE TABLE formula_components (
    id                  BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('formula_comp_id_seq'),
    formula_id          BIGINT      NOT NULL REFERENCES price_formulas(id),
    sequence_order      INTEGER     NOT NULL,
    component_label     VARCHAR(80) NOT NULL,
    component_type      VARCHAR(20) NOT NULL,
    weight              NUMERIC(10,6) NOT NULL,
    reference_index_id  BIGINT      REFERENCES price_indices(id),
    fixed_value         NUMERIC(20,6),
    price_cap           NUMERIC(20,6),
    price_floor         NUMERIC(20,6)
);

CREATE INDEX idx_formula_components_formula ON formula_components (formula_id);

-- ── trades ─────────────────────────────────────────────────
CREATE TABLE trades (
    id                 BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('trade_id_seq'),
    trade_reference    VARCHAR(30)  NOT NULL,
    trade_type         VARCHAR(20)  NOT NULL,
    status             VARCHAR(25)  NOT NULL DEFAULT 'DRAFT',
    counterparty_id    BIGINT       NOT NULL REFERENCES counterparties(id),
    commodity_id       BIGINT       NOT NULL REFERENCES commodities(id),
    book_id            BIGINT       NOT NULL REFERENCES books(id),
    trade_date         DATE         NOT NULL,
    start_date         DATE         NOT NULL,
    end_date           DATE         NOT NULL,
    quantity           NUMERIC(20,6) NOT NULL,
    quantity_unit      VARCHAR(20),
    pricing_type       VARCHAR(20)  NOT NULL,
    fixed_price        NUMERIC(20,6),
    price_index_id     BIGINT       REFERENCES price_indices(id),
    price_formula_id   BIGINT       REFERENCES price_formulas(id),
    spread             NUMERIC(20,6) DEFAULT 0.000000,
    currency           VARCHAR(3)   NOT NULL,
    notional_usd       NUMERIC(24,2),
    mtm_value_usd      NUMERIC(24,2),
    unrealized_pnl_usd NUMERIC(24,2),
    external_reference VARCHAR(50),
    internal_notes     VARCHAR(2000),
    version            INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    CONSTRAINT uq_trade_ref UNIQUE (trade_reference)
);

CREATE INDEX idx_trades_status          ON trades (status);
CREATE INDEX idx_trades_counterparty    ON trades (counterparty_id);
CREATE INDEX idx_trades_commodity       ON trades (commodity_id);
CREATE INDEX idx_trades_book            ON trades (book_id);
CREATE INDEX idx_trades_date            ON trades (trade_date);

-- ── delivery_schedules ─────────────────────────────────────
CREATE TABLE delivery_schedules (
    id                  BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('delivery_id_seq'),
    trade_id            BIGINT       NOT NULL REFERENCES trades(id),
    delivery_month      VARCHAR(7)   NOT NULL,
    scheduled_quantity  NUMERIC(20,6) NOT NULL,
    delivered_quantity  NUMERIC(20,6) DEFAULT 0.000000,
    status              VARCHAR(15)  NOT NULL DEFAULT 'PENDING',
    delivery_location   VARCHAR(100),
    nomination_ref      VARCHAR(50),
    CONSTRAINT uq_delivery UNIQUE (trade_id, delivery_month)
);

CREATE INDEX idx_delivery_trade ON delivery_schedules (trade_id);

-- ── positions ──────────────────────────────────────────────
CREATE TABLE positions (
    id              BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('position_id_seq'),
    book_id         BIGINT       NOT NULL REFERENCES books(id),
    commodity_id    BIGINT       NOT NULL REFERENCES commodities(id),
    delivery_month  VARCHAR(7)   NOT NULL,
    position_type   VARCHAR(15)  NOT NULL,
    long_qty        NUMERIC(20,6) DEFAULT 0.000000,
    short_qty       NUMERIC(20,6) DEFAULT 0.000000,
    net_qty         NUMERIC(20,6) DEFAULT 0.000000,
    quantity_unit   VARCHAR(20),
    avg_long_price  NUMERIC(20,6),
    avg_short_price NUMERIC(20,6),
    last_updated    TIMESTAMP WITH TIME ZONE,
    version         INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT uq_position UNIQUE (book_id, commodity_id, delivery_month, position_type)
);

CREATE INDEX idx_positions_book     ON positions (book_id);
CREATE INDEX idx_positions_delivery ON positions (delivery_month);

-- ── mtm_valuations ─────────────────────────────────────────
CREATE TABLE mtm_valuations (
    id               BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('mtm_id_seq'),
    trade_id         BIGINT       NOT NULL REFERENCES trades(id),
    valuation_date   DATE         NOT NULL,
    market_price     NUMERIC(20,6) NOT NULL,
    trade_price      NUMERIC(20,6) NOT NULL,
    mtm_price_usd    NUMERIC(20,6),
    open_quantity    NUMERIC(20,6),
    mtm_value_usd    NUMERIC(24,2) NOT NULL,
    fx_rate_to_usd   NUMERIC(12,6) DEFAULT 1.000000,
    valuation_method VARCHAR(30)  DEFAULT 'FORWARD_MARK',
    calculated_at    TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_mtm UNIQUE (trade_id, valuation_date)
);

CREATE INDEX idx_mtm_trade_date ON mtm_valuations (trade_id, valuation_date);

-- ── pnl_snapshots ──────────────────────────────────────────
CREATE TABLE pnl_snapshots (
    id                BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('pnl_id_seq'),
    book_id           BIGINT       NOT NULL REFERENCES books(id),
    commodity_id      BIGINT       REFERENCES commodities(id),
    snapshot_date     DATE         NOT NULL,
    daily_pnl_usd     NUMERIC(24,2),
    cumulative_pnl_usd NUMERIC(24,2),
    realized_pnl_usd  NUMERIC(24,2) DEFAULT 0.00,
    unrealized_pnl_usd NUMERIC(24,2),
    trade_count       INTEGER,
    calculated_at     TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_pnl UNIQUE (book_id, commodity_id, snapshot_date)
);

CREATE INDEX idx_pnl_book_date ON pnl_snapshots (book_id, snapshot_date);

-- ── risk_metrics ───────────────────────────────────────────
CREATE TABLE risk_metrics (
    id           BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('risk_id_seq'),
    book_id      BIGINT       REFERENCES books(id),
    commodity_id BIGINT       REFERENCES commodities(id),
    metric_type  VARCHAR(30)  NOT NULL,
    metric_date  DATE         NOT NULL,
    metric_value NUMERIC(24,6) NOT NULL,
    currency     VARCHAR(3)   DEFAULT 'USD',
    methodology  VARCHAR(200),
    calculated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_risk_metrics_book_date ON risk_metrics (book_id, metric_date);
CREATE INDEX idx_risk_metrics_type      ON risk_metrics (metric_type, metric_date);

-- ── credit_utilizations ────────────────────────────────────
CREATE TABLE credit_utilizations (
    id                   BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('credit_util_id_seq'),
    counterparty_id      BIGINT       NOT NULL REFERENCES counterparties(id),
    snapshot_date        DATE         NOT NULL,
    approved_limit_usd   NUMERIC(22,2),
    current_exposure_usd NUMERIC(22,2) DEFAULT 0.00,
    utilization_pct      NUMERIC(7,3),
    alert_level          VARCHAR(10)  DEFAULT 'GREEN',
    calculated_at        TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_credit_util UNIQUE (counterparty_id, snapshot_date)
);

CREATE INDEX idx_credit_util_cp_date ON credit_utilizations (counterparty_id, snapshot_date);

-- ── invoices ───────────────────────────────────────────────
CREATE TABLE invoices (
    id                BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('invoice_id_seq'),
    invoice_number    VARCHAR(30)  NOT NULL,
    trade_id          BIGINT       NOT NULL REFERENCES trades(id),
    counterparty_id   BIGINT       NOT NULL REFERENCES counterparties(id),
    status            VARCHAR(15)  NOT NULL DEFAULT 'DRAFT',
    invoice_date      DATE         NOT NULL,
    due_date          DATE         NOT NULL,
    delivery_month    VARCHAR(7),
    invoiced_quantity NUMERIC(20,6) NOT NULL,
    unit_price        NUMERIC(20,6) NOT NULL,
    subtotal_usd      NUMERIC(24,2),
    tax_amount_usd    NUMERIC(24,2) DEFAULT 0.00,
    total_amount_usd  NUMERIC(24,2) NOT NULL,
    currency          VARCHAR(3)   NOT NULL,
    payment_terms     VARCHAR(30)  DEFAULT 'NET30',
    dispute_reason    VARCHAR(500),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE,
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100),
    CONSTRAINT uq_invoice_num UNIQUE (invoice_number)
);

CREATE INDEX idx_invoices_trade  ON invoices (trade_id);
CREATE INDEX idx_invoices_status ON invoices (status);

-- ── payments ───────────────────────────────────────────────
CREATE TABLE payments (
    id               BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('payment_id_seq'),
    invoice_id       BIGINT       NOT NULL REFERENCES invoices(id),
    payment_date     DATE         NOT NULL,
    amount_usd       NUMERIC(24,2) NOT NULL,
    currency         VARCHAR(3)   NOT NULL,
    fx_rate_to_usd   NUMERIC(12,6) DEFAULT 1.000000,
    payment_reference VARCHAR(50),
    payment_method   VARCHAR(20)  DEFAULT 'SWIFT',
    recorded_at      TIMESTAMP WITH TIME ZONE,
    recorded_by      VARCHAR(100)
);

CREATE INDEX idx_payments_invoice ON payments (invoice_id);
