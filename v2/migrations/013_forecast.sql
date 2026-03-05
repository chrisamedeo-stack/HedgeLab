-- ============================================================================
-- Migration 013: Forecasting Module
-- Plugin: forecast (fct_ prefix)
-- Dependencies: budget, market_data
-- ============================================================================

-- ─── Scenarios ──────────────────────────────────────────────────────────────

CREATE TABLE fct_scenarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  scenario_type VARCHAR(30) NOT NULL,
  base_date     DATE DEFAULT CURRENT_DATE,
  base_commodity VARCHAR(20),
  base_site_id  UUID,
  assumptions   JSONB NOT NULL DEFAULT '{}',
  results       JSONB,
  status        VARCHAR(20) DEFAULT 'draft',
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_scenario_type CHECK (scenario_type IN ('price_move','volume_change','what_if','stress_test')),
  CONSTRAINT chk_scenario_status CHECK (status IN ('draft','running','completed','failed'))
);

CREATE INDEX idx_fct_scenarios_org ON fct_scenarios(org_id);
CREATE INDEX idx_fct_scenarios_type ON fct_scenarios(org_id, scenario_type);

-- ─── Scenario Results ───────────────────────────────────────────────────────

CREATE TABLE fct_scenario_results (
  id                      BIGSERIAL PRIMARY KEY,
  scenario_id             UUID NOT NULL REFERENCES fct_scenarios(id) ON DELETE CASCADE,
  site_id                 UUID,
  commodity_id            VARCHAR(20) NOT NULL,
  label                   VARCHAR(100),
  current_coverage_pct    NUMERIC,
  current_all_in_price    NUMERIC,
  current_mtm_pnl         NUMERIC,
  current_open_volume     NUMERIC,
  projected_coverage_pct  NUMERIC,
  projected_all_in_price  NUMERIC,
  projected_mtm_pnl       NUMERIC,
  projected_open_volume   NUMERIC,
  coverage_change         NUMERIC,
  price_change            NUMERIC,
  pnl_change              NUMERIC,
  volume_change           NUMERIC,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fct_results_scenario ON fct_scenario_results(scenario_id);
