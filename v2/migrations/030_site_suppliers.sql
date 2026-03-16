-- 030_site_suppliers.sql
-- Junction table linking sites to counterparties (suppliers)
-- Soft FK to ct_counterparties (cross-module boundary)

CREATE TABLE IF NOT EXISTS site_suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  counterparty_id UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, counterparty_id)
);

CREATE INDEX IF NOT EXISTS idx_site_suppliers_site ON site_suppliers(site_id);
CREATE INDEX IF NOT EXISTS idx_site_suppliers_cp   ON site_suppliers(counterparty_id);
