-- Migration 024: Supplier/Counterparty entity types + credit tracking + physical position supplier link

-- 1a. Add entity_type to ct_counterparties
ALTER TABLE ct_counterparties
  ADD COLUMN entity_type VARCHAR(20) NOT NULL DEFAULT 'both'
    CHECK (entity_type IN ('supplier','counterparty','both'));

-- 1b. Add credit tracking columns
ALTER TABLE ct_counterparties
  ADD COLUMN credit_used NUMERIC(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN credit_status VARCHAR(20) NOT NULL DEFAULT 'good'
    CHECK (credit_status IN ('good','warning','exceeded','suspended'));

-- 1c. Add supplier_id and contract_ref to pm_physical_positions
ALTER TABLE pm_physical_positions
  ADD COLUMN supplier_id UUID REFERENCES ct_counterparties(id),
  ADD COLUMN contract_ref VARCHAR(100);
