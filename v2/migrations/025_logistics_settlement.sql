-- Migration 025: Logistics + Settlement
-- Step 12 — delivery tracking, inventory snapshots, invoicing

-- ─── Logistics Tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lg_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  site_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL,
  contract_id UUID,
  delivery_date DATE NOT NULL,
  volume NUMERIC NOT NULL,
  unit VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
  carrier VARCHAR(200),
  vehicle_id VARCHAR(50),
  origin VARCHAR(200),
  destination VARCHAR(200),
  freight_cost NUMERIC,
  quality_results JSONB DEFAULT '{}',
  weight_ticket VARCHAR(50),
  notes TEXT,
  import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_deliveries_org ON lg_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_lg_deliveries_site ON lg_deliveries(site_id);
CREATE INDEX IF NOT EXISTS idx_lg_deliveries_commodity ON lg_deliveries(commodity_id);
CREATE INDEX IF NOT EXISTS idx_lg_deliveries_contract ON lg_deliveries(contract_id);
CREATE INDEX IF NOT EXISTS idx_lg_deliveries_date ON lg_deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_lg_deliveries_status ON lg_deliveries(status);

CREATE TABLE IF NOT EXISTS lg_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  commodity_id VARCHAR(20) NOT NULL,
  as_of_date DATE NOT NULL,
  on_hand_volume NUMERIC NOT NULL,
  committed_out NUMERIC DEFAULT 0,
  available NUMERIC GENERATED ALWAYS AS (on_hand_volume - committed_out) STORED,
  unit VARCHAR(20) NOT NULL,
  avg_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, commodity_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_lg_inventory_site ON lg_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_lg_inventory_commodity ON lg_inventory(commodity_id);

-- ─── Settlement Tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stl_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  counterparty_id UUID,
  counterparty_name VARCHAR(200),
  invoice_type VARCHAR(20) NOT NULL
    CHECK (invoice_type IN ('purchase', 'sale')),
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  invoice_number VARCHAR(50),
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  freight NUMERIC DEFAULT 0,
  adjustments NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  line_items JSONB NOT NULL DEFAULT '[]',
  payment_date DATE,
  payment_ref VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stl_invoices_org ON stl_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_stl_invoices_counterparty ON stl_invoices(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_stl_invoices_status ON stl_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stl_invoices_type ON stl_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_stl_invoices_date ON stl_invoices(invoice_date);

-- ─── Permissions (idempotent) ────────────────────────────────────────────────

INSERT INTO permissions (id, module, action) VALUES
  ('logistics.read', 'logistics', 'read'),
  ('logistics.record_delivery', 'logistics', 'record_delivery'),
  ('logistics.manage_inventory', 'logistics', 'manage_inventory'),
  ('settlement.read', 'settlement', 'read'),
  ('settlement.create_invoice', 'settlement', 'create_invoice'),
  ('settlement.issue_invoice', 'settlement', 'issue_invoice'),
  ('settlement.record_payment', 'settlement', 'record_payment')
ON CONFLICT (id) DO NOTHING;

-- Grant to admin and trader roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.module IN ('logistics', 'settlement')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'trader'
  AND p.module IN ('logistics', 'settlement')
  AND p.action IN ('read', 'record_delivery')
ON CONFLICT DO NOTHING;

-- ─── Plugin Registry (idempotent) ────────────────────────────────────────────

INSERT INTO plugin_registry (id, name, module_prefix, nav_section, nav_label, nav_href, sort_order)
VALUES
  ('logistics', 'Logistics', 'lg', 'Operations', 'Logistics', '/logistics', 40),
  ('settlement', 'Settlement', 'stl', 'Operations', 'Settlement', '/settlement', 45)
ON CONFLICT (id) DO NOTHING;

-- Enable for first org (if exists)
INSERT INTO org_plugins (org_id, plugin_id, is_enabled)
SELECT o.id, p.id, true
FROM organizations o
CROSS JOIN (VALUES ('logistics'), ('settlement')) AS p(id)
WHERE o.is_active = true
ORDER BY o.created_at ASC
LIMIT 2
ON CONFLICT (org_id, plugin_id) DO NOTHING;
