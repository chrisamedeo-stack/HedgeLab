-- 1. Forecast columns on existing budget lines
ALTER TABLE corn_budget_lines
    ADD COLUMN forecast_volume_mt NUMERIC(14,4),
    ADD COLUMN forecast_volume_bu NUMERIC(16,2);

-- 2. Forecast history log
CREATE TABLE corn_forecast_history (
    id              BIGSERIAL PRIMARY KEY,
    budget_line_id  BIGINT NOT NULL REFERENCES corn_budget_lines(id) ON DELETE CASCADE,
    forecast_mt     NUMERIC(14,4) NOT NULL,
    forecast_bu     NUMERIC(16,2) NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by     VARCHAR(100),
    notes           VARCHAR(500)
);
CREATE INDEX idx_forecast_hist_line ON corn_forecast_history(budget_line_id, recorded_at DESC);
