-- Migration 033: Expand pricing_type CHECK constraint to include hta and index
-- These new pricing types are used by the PhysicalContractForm

ALTER TABLE ct_physical_contracts DROP CONSTRAINT IF EXISTS chk_ct_pricing;
ALTER TABLE ct_physical_contracts ADD CONSTRAINT chk_ct_pricing
  CHECK (pricing_type IN ('fixed', 'basis', 'formula', 'hta', 'index'));
