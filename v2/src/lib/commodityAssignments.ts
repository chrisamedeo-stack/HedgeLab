import { queryAll, queryOne, query } from "./db";

export interface DirectCommodity {
  commodity_id: string;
  commodity_name: string;
}

export interface InheritedCommodity {
  commodity_id: string;
  commodity_name: string;
  source_name: string;
  source_level: string;
}

/** Get commodities directly assigned to an entity */
export async function getDirectCommodities(
  entityType: string,
  entityId: string
): Promise<DirectCommodity[]> {
  return queryAll<DirectCommodity>(
    `SELECT ca.commodity_id, c.name AS commodity_name
     FROM commodity_assignments ca
     JOIN commodities c ON c.id = ca.commodity_id
     WHERE ca.entity_type = $1 AND ca.entity_id = $2
     ORDER BY c.name`,
    [entityType, entityId]
  );
}

/** Get commodities inherited from ancestor org units */
export async function getInheritedCommodities(
  entityType: string,
  entityId: string
): Promise<InheritedCommodity[]> {
  // For sites, walk up from the site's org_unit
  // For org_units, walk up from the unit's parent
  if (entityType === "site") {
    const site = await queryOne<{ org_unit_id: string | null }>(
      `SELECT org_unit_id FROM sites WHERE id = $1`,
      [entityId]
    );
    if (!site?.org_unit_id) return [];

    // Get commodities from the site's org_unit and all its ancestors
    return queryAll<InheritedCommodity>(
      `SELECT DISTINCT ca.commodity_id, c.name AS commodity_name,
              ou.name::TEXT AS source_name, ohl.label::TEXT AS source_level
       FROM (
         -- The org unit the site belongs to
         SELECT $1::UUID AS unit_id
         UNION ALL
         -- Plus all ancestors of that org unit
         SELECT a.unit_id FROM get_ancestor_units($1::UUID) a
       ) units
       JOIN commodity_assignments ca ON ca.entity_type = 'org_unit' AND ca.entity_id = units.unit_id
       JOIN commodities c ON c.id = ca.commodity_id
       JOIN org_units ou ON ou.id = units.unit_id
       JOIN org_hierarchy_levels ohl ON ohl.id = ou.hierarchy_level_id
       ORDER BY c.name`,
      [site.org_unit_id]
    );
  }

  // For org_units, get from ancestors only
  return queryAll<InheritedCommodity>(
    `SELECT DISTINCT ca.commodity_id, c.name AS commodity_name,
            a.unit_name AS source_name, a.level_label AS source_level
     FROM get_ancestor_units($1) a
     JOIN commodity_assignments ca ON ca.entity_type = 'org_unit' AND ca.entity_id = a.unit_id
     JOIN commodities c ON c.id = ca.commodity_id
     ORDER BY c.name`,
    [entityId]
  );
}

/** Get effective commodities (direct + inherited, deduped) */
export async function getEffectiveCommodities(
  entityType: string,
  entityId: string
): Promise<{ direct: DirectCommodity[]; inherited: InheritedCommodity[] }> {
  const [direct, inherited] = await Promise.all([
    getDirectCommodities(entityType, entityId),
    getInheritedCommodities(entityType, entityId),
  ]);

  // Filter inherited to exclude any that are also directly assigned
  const directIds = new Set(direct.map((d) => d.commodity_id));
  const filteredInherited = inherited.filter((i) => !directIds.has(i.commodity_id));

  return { direct, inherited: filteredInherited };
}

/** Assign a commodity to an entity */
export async function assignCommodity(
  orgId: string,
  entityType: string,
  entityId: string,
  commodityId: string
): Promise<void> {
  await query(
    `INSERT INTO commodity_assignments (org_id, entity_type, entity_id, commodity_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, entity_type, entity_id, commodity_id) DO NOTHING`,
    [orgId, entityType, entityId, commodityId]
  );
}

/** Remove a direct commodity assignment */
export async function removeCommodity(
  orgId: string,
  entityType: string,
  entityId: string,
  commodityId: string
): Promise<void> {
  await query(
    `DELETE FROM commodity_assignments
     WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3 AND commodity_id = $4`,
    [orgId, entityType, entityId, commodityId]
  );
}
