-- ============================================================
-- HedgeLab CTRM Platform — Application Users
-- V3: app_user table + default admin account
-- ============================================================

CREATE SEQUENCE app_user_id_seq START 1 INCREMENT 1;

CREATE TABLE app_user (
    id            BIGINT      NOT NULL PRIMARY KEY DEFAULT nextval('app_user_id_seq'),
    username      VARCHAR(50) NOT NULL,
    email         VARCHAR(150),
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'READ_ONLY',
    enabled       BOOLEAN     NOT NULL DEFAULT true,
    CONSTRAINT uq_user_username UNIQUE (username)
);

-- Default admin user: username=admin, password=admin123
-- BCrypt hash generated with strength 10
INSERT INTO app_user (username, email, password_hash, role, enabled) VALUES
('admin',        'admin@hedgelab.com',        '$2b$10$VMiaurzj8CUXO4hDov7.nOZMzy2GZOVQiPSl.9vees0loCPwZFDYa', 'ADMIN',        true),
('risk_manager', 'risk@hedgelab.com',         '$2b$10$VMiaurzj8CUXO4hDov7.nOZMzy2GZOVQiPSl.9vees0loCPwZFDYa', 'RISK_MANAGER',  true),
('trader',       'trader@hedgelab.com',        '$2b$10$VMiaurzj8CUXO4hDov7.nOZMzy2GZOVQiPSl.9vees0loCPwZFDYa', 'TRADER',       true),
('readonly',     'readonly@hedgelab.com',      '$2b$10$VMiaurzj8CUXO4hDov7.nOZMzy2GZOVQiPSl.9vees0loCPwZFDYa', 'READ_ONLY',    true);
