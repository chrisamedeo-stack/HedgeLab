-- Step 9: Charts & Dashboard
-- crt_dashboards — user-configurable dashboard layouts (schema-ready for future grid config)

CREATE TABLE crt_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  name VARCHAR(200) DEFAULT 'My Dashboard',
  layout JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crt_dashboards_user ON crt_dashboards(user_id, org_id);
