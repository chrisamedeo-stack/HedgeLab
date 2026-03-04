-- HedgeLab v2 — Migration 010: Admin UI Support
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS futures_month_mappings JSONB DEFAULT '{}';
