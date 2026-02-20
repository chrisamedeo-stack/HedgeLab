-- ============================================================
-- HedgeLab CTRM Platform — Audit Log
-- V4: audit_log table for immutable event history
-- ============================================================

CREATE SEQUENCE audit_log_id_seq START 1 INCREMENT 1;

CREATE TABLE audit_log (
    id             BIGINT       NOT NULL PRIMARY KEY DEFAULT nextval('audit_log_id_seq'),
    entity_type    VARCHAR(100) NOT NULL,
    entity_id      BIGINT,
    action         VARCHAR(20)  NOT NULL,
    performed_by   VARCHAR(100),
    performed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    old_value      TEXT,
    new_value      TEXT,
    change_summary VARCHAR(500)
);

CREATE INDEX idx_audit_entity      ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_performed_at ON audit_log (performed_at DESC);
CREATE INDEX idx_audit_performed_by ON audit_log (performed_by);
