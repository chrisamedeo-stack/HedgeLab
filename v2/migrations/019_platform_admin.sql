-- 019_platform_admin.sql
-- Platform Admin Console: multi-org management tables

-- Platform-level settings (not per-org)
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription/billing metadata on organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'standard';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 50;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_sites INT DEFAULT 100;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes TEXT;
