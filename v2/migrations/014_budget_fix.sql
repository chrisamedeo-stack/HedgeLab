-- 014: Fix missing budget schema — columns and tables from 007 that didn't apply

-- Add missing column to bgt_line_items
ALTER TABLE bgt_line_items ADD COLUMN IF NOT EXISTS futures_month VARCHAR(20);

-- Create bgt_line_item_components (was in 007 but table missing)
CREATE TABLE IF NOT EXISTS bgt_line_item_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id    UUID NOT NULL REFERENCES bgt_line_items(id) ON DELETE CASCADE,
  component_name  VARCHAR(100) NOT NULL,
  unit            VARCHAR(20) NOT NULL DEFAULT '$/bu',
  target_value    NUMERIC NOT NULL DEFAULT 0,
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bgt_components_line_item ON bgt_line_item_components(line_item_id);

-- Create bgt_forecast_history (was in 007 but table missing)
CREATE TABLE IF NOT EXISTS bgt_forecast_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id    UUID NOT NULL REFERENCES bgt_line_items(id) ON DELETE CASCADE,
  forecast_volume NUMERIC,
  forecast_price  NUMERIC,
  recorded_at     TIMESTAMPTZ DEFAULT now(),
  recorded_by     VARCHAR(255),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_bgt_forecast_history_line_item ON bgt_forecast_history(line_item_id);
