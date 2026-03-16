-- 028_commodity_assignments.sql
-- Commodity assignments per org unit / site with inheritance

BEGIN;

-- ─── Commodity Assignments Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commodity_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type   VARCHAR(20) NOT NULL CHECK (entity_type IN ('org_unit', 'site')),
  entity_id     UUID NOT NULL,
  commodity_id  VARCHAR(20) NOT NULL REFERENCES commodities(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, entity_type, entity_id, commodity_id)
);

CREATE INDEX IF NOT EXISTS idx_commodity_assignments_entity
  ON commodity_assignments (entity_type, entity_id);

-- ─── Ancestor Units Function ─────────────────────────────────────────────────
-- Walks up org_units.parent_id returning all ancestors (excluding self)
CREATE OR REPLACE FUNCTION get_ancestor_units(p_unit_id UUID)
RETURNS TABLE (unit_id UUID, unit_name TEXT, level_label TEXT, depth INT) AS $$
  WITH RECURSIVE ancestors AS (
    -- Start from parent of the given unit
    SELECT ou.parent_id AS id, 1 AS dist
    FROM org_units ou
    WHERE ou.id = p_unit_id AND ou.parent_id IS NOT NULL

    UNION ALL

    SELECT ou.parent_id, a.dist + 1
    FROM ancestors a
    JOIN org_units ou ON ou.id = a.id
    WHERE ou.parent_id IS NOT NULL
  )
  SELECT ou.id AS unit_id,
         ou.name::TEXT AS unit_name,
         ohl.label::TEXT AS level_label,
         ohl.level_depth AS depth
  FROM ancestors a
  JOIN org_units ou ON ou.id = a.id
  JOIN org_hierarchy_levels ohl ON ohl.id = ou.hierarchy_level_id
  ORDER BY ohl.level_depth;
$$ LANGUAGE SQL STABLE;

COMMIT;
