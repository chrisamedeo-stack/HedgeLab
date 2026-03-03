-- Fix bgt_periods.commodity_id to match commodities.id type (VARCHAR not UUID)
-- Existing test data has UUID commodity_ids that don't reference real commodities — clean up first
DELETE FROM bgt_line_items WHERE period_id IN (SELECT id FROM bgt_periods);
DELETE FROM bgt_versions WHERE period_id IN (SELECT id FROM bgt_periods);
DELETE FROM bgt_periods;
ALTER TABLE bgt_periods ALTER COLUMN commodity_id TYPE VARCHAR(20) USING commodity_id::text;
