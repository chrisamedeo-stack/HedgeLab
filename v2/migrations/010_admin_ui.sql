-- ============================================================================
-- HedgeLab v2 — Migration 010: Admin UI Support
-- ============================================================================
-- Adds:
--   1. futures_month_mappings JSONB column to org_settings
-- ============================================================================

BEGIN;

ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS futures_month_mappings JSONB DEFAULT '{}';

COMMIT;
