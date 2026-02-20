-- ============================================================
-- HedgeLab CTRM Platform — Trade Amendments
-- V5: Add amendment tracking columns to trades table
-- ============================================================

ALTER TABLE trades
    ADD COLUMN amendment_count   INTEGER DEFAULT 0,
    ADD COLUMN amended_at        TIMESTAMP WITH TIME ZONE,
    ADD COLUMN amended_by        VARCHAR(100),
    ADD COLUMN amendment_reason  TEXT,
    ADD COLUMN implied_volatility NUMERIC(10,6);
