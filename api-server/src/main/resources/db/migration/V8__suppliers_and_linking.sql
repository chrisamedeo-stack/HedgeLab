-- V8: Suppliers entity and site linking tables

-- Suppliers
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    country         VARCHAR(50),
    contact_email   VARCHAR(150),
    contact_phone   VARCHAR(30),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100)
);

-- Link suppliers to sites (many-to-many)
CREATE TABLE site_suppliers (
    id              BIGSERIAL PRIMARY KEY,
    site_id         BIGINT NOT NULL REFERENCES corn_sites(id) ON DELETE CASCADE,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE(site_id, supplier_id)
);

-- Link commodities to sites (many-to-many)
CREATE TABLE site_commodities (
    id              BIGSERIAL PRIMARY KEY,
    site_id         BIGINT NOT NULL REFERENCES corn_sites(id) ON DELETE CASCADE,
    commodity_id    BIGINT NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    UNIQUE(site_id, commodity_id)
);
