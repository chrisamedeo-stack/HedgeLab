-- ============================================================
-- HedgeLab CTRM Platform — Seed Reference Data
-- V2: Commodities, counterparties, books, price indices,
--     365 days of daily prices per index (required for VaR)
-- ============================================================

-- ── Commodities ────────────────────────────────────────────
INSERT INTO commodities (code, name, category, unit_of_measure, currency, hedgeable, active, description, icis_code, created_at, created_by) VALUES
('BRENT',  'Brent Crude Oil',  'ENERGY',        'BBL',    'USD', true,  true, 'ICE Brent Crude Oil Futures',          'AAWTR00',   NOW(), 'system'),
('WTI',    'WTI Crude Oil',    'ENERGY',        'BBL',    'USD', true,  true, 'NYMEX WTI Light Sweet Crude',           'AAVBD00',   NOW(), 'system'),
('NATGAS', 'Natural Gas',      'ENERGY',        'MMBTU',  'USD', true,  true, 'Henry Hub Natural Gas',                 'NGUSHHUB',  NOW(), 'system'),
('COPPER', 'LME Copper',       'METALS',        'MT',     'USD', true,  true, 'LME Grade A Copper',                    'LMCADY00',  NOW(), 'system'),
('CORN',   'CBOT Corn',        'AGRICULTURAL',  'BUSHEL', 'USD', true,  true, 'CBOT Corn Futures',                     NULL,        NOW(), 'system');

-- ── Counterparties ─────────────────────────────────────────
INSERT INTO counterparties (legal_entity_code, lei, short_name, full_legal_name, type, status, credit_rating, credit_limit_usd, current_exposure_usd, country, registration_number, contact_email, contact_phone, onboarded_date, internal_notes, created_at, created_by) VALUES
('SHELL-TRD', '2138001SCL7RPEZRV149', 'Shell Trading',    'Shell Trading and Shipping Company', 'TRADER',   'ACTIVE', 'AA',  500000000.00, 0.00, 'GB', 'RC-12345678', 'trading@shell.com',  '+44-20-7934-1234', '2020-01-15', 'Major energy trader',           NOW(), 'system'),
('BP-OIL',    'BPPTDE6SXBP6SWZOR7B8', 'BP Oil International', 'BP Oil International Ltd',    'PRODUCER', 'ACTIVE', 'A',   250000000.00, 0.00, 'GB', 'RC-87654321', 'oil-trading@bp.com', '+44-20-7496-4000', '2019-06-01', 'Oil major',                     NOW(), 'system'),
('VITOL-GEN', 'VITOLGE22XXX00000000', 'Vitol Group',      'Vitol Group Holdings SA',            'TRADER',   'ACTIVE', 'BBB', 100000000.00, 0.00, 'CH', 'CHE-123.456.789', 'trading@vitol.com', '+41-22-322-4800', '2021-03-10', 'Independent commodity trader', NOW(), 'system');

-- ── Books ──────────────────────────────────────────────────
INSERT INTO books (book_code, display_name, trading_desk, description, active, created_at, created_by) VALUES
('ENERGY-CRUDE', 'Crude Oil Trading Book', 'Energy Desk',  'Primary book for crude oil physical and financial trades', true, NOW(), 'system'),
('ENERGY-GAS',   'Natural Gas Book',       'Energy Desk',  'Natural gas physical and financial trading',               true, NOW(), 'system'),
('METALS-BASE',  'Base Metals Book',       'Metals Desk',  'LME base metals trading book',                            true, NOW(), 'system');

-- ── Price Indices ──────────────────────────────────────────
INSERT INTO price_indices (index_code, display_name, commodity_id, provider, currency, unit, active, description, created_at, created_by)
SELECT 'ICE-BRENT-1M', 'ICE Brent Front Month',   c.id, 'ICE',   'USD', 'BBL',    true, 'ICE Brent 1-month front contract',            NOW(), 'system' FROM commodities c WHERE c.code = 'BRENT';
INSERT INTO price_indices (index_code, display_name, commodity_id, provider, currency, unit, active, description, created_at, created_by)
SELECT 'NYMEX-WTI-1M',  'NYMEX WTI Front Month',   c.id, 'NYMEX', 'USD', 'BBL',    true, 'NYMEX WTI 1-month front contract',            NOW(), 'system' FROM commodities c WHERE c.code = 'WTI';
INSERT INTO price_indices (index_code, display_name, commodity_id, provider, currency, unit, active, description, created_at, created_by)
SELECT 'HH-NG-1M',      'Henry Hub Front Month',   c.id, 'NYMEX', 'USD', 'MMBTU',  true, 'Henry Hub natural gas front month',           NOW(), 'system' FROM commodities c WHERE c.code = 'NATGAS';
INSERT INTO price_indices (index_code, display_name, commodity_id, provider, currency, unit, active, description, created_at, created_by)
SELECT 'LME-CU-CASH',   'LME Copper Cash',         c.id, 'LME',   'USD', 'MT',     true, 'LME Copper cash settlement price',            NOW(), 'system' FROM commodities c WHERE c.code = 'COPPER';

-- ── 365 Daily Prices per Index (for VaR lookback) ─────────
-- Brent: random walk around 82 USD/bbl
INSERT INTO daily_prices (price_index_id, price_date, price, price_type, source, confirmed, created_by)
SELECT
    pi.id,
    d::DATE,
    ROUND((
        80.00 + 10.0 * SIN(EXTRACT(DOY FROM d::DATE) * 0.05)
             +  5.0 * COS(EXTRACT(DOY FROM d::DATE) * 0.13)
             +  3.0 * SIN(EXTRACT(DOY FROM d::DATE) * 0.27)
             + (EXTRACT(DOY FROM d::DATE)::FLOAT / 365.0) * 4.0
    )::NUMERIC, 6),
    'SETTLE', 'SEED', true, 'system'
FROM price_indices pi
CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '366 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') AS d
WHERE pi.index_code = 'ICE-BRENT-1M'
ON CONFLICT (price_index_id, price_date, price_type) DO NOTHING;

-- WTI: tracks Brent with ~3.50 discount
INSERT INTO daily_prices (price_index_id, price_date, price, price_type, source, confirmed, created_by)
SELECT
    pi.id,
    d::DATE,
    ROUND((
        76.50 + 9.0  * SIN(EXTRACT(DOY FROM d::DATE) * 0.05)
              +  4.5  * COS(EXTRACT(DOY FROM d::DATE) * 0.13)
              +  2.5  * SIN(EXTRACT(DOY FROM d::DATE) * 0.27)
              + (EXTRACT(DOY FROM d::DATE)::FLOAT / 365.0) * 4.0
    )::NUMERIC, 6),
    'SETTLE', 'SEED', true, 'system'
FROM price_indices pi
CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '366 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') AS d
WHERE pi.index_code = 'NYMEX-WTI-1M'
ON CONFLICT (price_index_id, price_date, price_type) DO NOTHING;

-- Henry Hub: seasonal gas price (higher in winter/summer)
INSERT INTO daily_prices (price_index_id, price_date, price, price_type, source, confirmed, created_by)
SELECT
    pi.id,
    d::DATE,
    ROUND(GREATEST(1.50, (
        2.20 + 0.80 * SIN((EXTRACT(DOY FROM d::DATE) - 30) * 0.0172)
             + 0.40 * SIN((EXTRACT(DOY FROM d::DATE) - 200) * 0.0345)
             + 0.15 * COS(EXTRACT(DOY FROM d::DATE) * 0.25)
    ))::NUMERIC, 6),
    'SETTLE', 'SEED', true, 'system'
FROM price_indices pi
CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '366 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') AS d
WHERE pi.index_code = 'HH-NG-1M'
ON CONFLICT (price_index_id, price_date, price_type) DO NOTHING;

-- LME Copper: industrial demand trend
INSERT INTO daily_prices (price_index_id, price_date, price, price_type, source, confirmed, created_by)
SELECT
    pi.id,
    d::DATE,
    ROUND((
        9000 + 500 * SIN(EXTRACT(DOY FROM d::DATE) * 0.04)
             + 300 * COS(EXTRACT(DOY FROM d::DATE) * 0.11)
             + 200 * SIN(EXTRACT(DOY FROM d::DATE) * 0.29)
             + (EXTRACT(DOY FROM d::DATE)::FLOAT / 365.0) * 600
    )::NUMERIC, 6),
    'SETTLE', 'SEED', true, 'system'
FROM price_indices pi
CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '366 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') AS d
WHERE pi.index_code = 'LME-CU-CASH'
ON CONFLICT (price_index_id, price_date, price_type) DO NOTHING;

-- ── Forward Curve Points (Brent) ──────────────────────────
INSERT INTO forward_curve_points (price_index_id, curve_date, delivery_month, forward_price, created_at)
SELECT
    pi.id,
    CURRENT_DATE,
    TO_CHAR(CURRENT_DATE + (m || ' months')::INTERVAL, 'YYYY-MM'),
    ROUND((83.10 - m * 0.30)::NUMERIC, 6),
    NOW()
FROM price_indices pi
CROSS JOIN generate_series(0, 11) AS m
WHERE pi.index_code = 'ICE-BRENT-1M'
ON CONFLICT (price_index_id, curve_date, delivery_month) DO NOTHING;

-- ── Forward Curve Points (WTI) ────────────────────────────
INSERT INTO forward_curve_points (price_index_id, curve_date, delivery_month, forward_price, created_at)
SELECT
    pi.id,
    CURRENT_DATE,
    TO_CHAR(CURRENT_DATE + (m || ' months')::INTERVAL, 'YYYY-MM'),
    ROUND((79.55 - m * 0.25)::NUMERIC, 6),
    NOW()
FROM price_indices pi
CROSS JOIN generate_series(0, 11) AS m
WHERE pi.index_code = 'NYMEX-WTI-1M'
ON CONFLICT (price_index_id, curve_date, delivery_month) DO NOTHING;
