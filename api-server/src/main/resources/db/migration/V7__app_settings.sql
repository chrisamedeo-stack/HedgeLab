CREATE TABLE app_settings (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    value       TEXT NOT NULL,
    description VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, value, description) VALUES
('FISCAL_YEAR_START_MONTH', '7', 'Month number (1-12) when the fiscal year begins'),
('FUTURES_MONTH_MAPPINGS', '{"H":[12,1,2],"K":[3,4],"N":[5,6],"U":[7,8],"Z":[9,10,11]}', 'JSON mapping of CBOT month letters to delivery month numbers');
