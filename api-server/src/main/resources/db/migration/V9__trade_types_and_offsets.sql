-- 1. Trade type on physical contracts (INDEX or BASIS)
ALTER TABLE corn_physical_contracts
    ADD COLUMN trade_type VARCHAR(10) NOT NULL DEFAULT 'BASIS';

-- 2. Entry price snapshot on EFP tickets (for gain/loss)
ALTER TABLE corn_efp_tickets
    ADD COLUMN entry_price NUMERIC(10,4);

-- 3. Hedge offset table (futures closed without EFP)
CREATE TABLE corn_hedge_offsets (
    id              BIGSERIAL PRIMARY KEY,
    hedge_trade_id  BIGINT NOT NULL REFERENCES corn_hedge_trades(id),
    site_id         BIGINT REFERENCES corn_sites(id),
    allocation_id   BIGINT REFERENCES corn_hedge_allocations(id),
    lots            INTEGER NOT NULL,
    exit_price      NUMERIC(10,4) NOT NULL,
    offset_date     DATE NOT NULL,
    realized_pnl    NUMERIC(12,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(100)
);
