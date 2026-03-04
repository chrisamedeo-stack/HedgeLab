// ─── Org Hierarchy Types ──────────────────────────────────────────────────

export interface HierarchyLevel {
  id: string;
  org_id: string;
  level_depth: number;
  label: string;
  is_site_level: boolean;
}

export interface OrgUnit {
  id: string;
  org_id: string;
  hierarchy_level_id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteRef {
  id: string;
  name: string;
  code: string;
  site_type_name: string;
}

export interface OrgTreeNode {
  id: string;
  name: string;
  code: string | null;
  level_depth: number;
  level_label: string;
  parent_id: string | null;
  children: OrgTreeNode[];
  sites: SiteRef[];
}

// ─── Plugin System Types ──────────────────────────────────────────────────

export interface PluginRegistryEntry {
  id: string;
  name: string;
  module_prefix: string | null;
  depends_on: string[];
  nav_section: string | null;
  nav_label: string | null;
  nav_href: string | null;
  nav_icon: string | null;
  sort_order: number;
  description: string | null;
}

export interface OrgPlugin {
  id: string;
  org_id: string;
  plugin_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  // Joined from plugin_registry
  plugin_name?: string;
  nav_section?: string | null;
  nav_label?: string | null;
  nav_href?: string | null;
  nav_icon?: string | null;
  sort_order?: number;
  depends_on?: string[];
}

// ─── Customer Profile Types ──────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  display_name: string;
  operating_model: "budget" | "margin";
  default_plugins: string[];
  hierarchy_template: HierarchyTemplateLevel[];
  default_site_types: string[];
  default_settings: Record<string, unknown>;
  description: string | null;
}

export interface HierarchyTemplateLevel {
  depth: number;
  label: string;
  is_site_level?: boolean;
}

// ─── Nav Config Types ────────────────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  pluginId: string;
  icon?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
