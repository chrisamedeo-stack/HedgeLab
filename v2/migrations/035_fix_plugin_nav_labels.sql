-- ============================================================================
-- HedgeLab v2 — Migration 035: Fix Plugin Nav Labels
-- ============================================================================
-- Updates plugin_registry nav_label and nav_href for position_manager
-- to match the frontend PLUGIN_NAV mapping.
-- ============================================================================

BEGIN;

UPDATE plugin_registry
SET nav_label = 'Position Manager',
    nav_href  = '/position-manager',
    description = 'Position manager, allocations, EFP, offset, rollover'
WHERE id = 'position_manager';

COMMIT;
