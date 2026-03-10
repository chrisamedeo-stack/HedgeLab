// ─── Platform Admin Types ─────────────────────────────────────────────

export interface OrgSummary {
  id: string;
  name: string;
  customer_profile_id: string | null;
  profile_name: string | null;
  is_active: boolean;
  subscription_tier: string;
  subscription_status: string;
  max_users: number;
  max_sites: number;
  user_count: number;
  site_count: number;
  plugin_count: number;
  created_at: string;
}

export interface OrgDetail extends OrgSummary {
  base_currency: string;
  settings: Record<string, unknown>;
  notes: string | null;
  enabled_plugins: string[];
}

export interface PlatformStats {
  total_orgs: number;
  active_orgs: number;
  total_users: number;
  total_sites: number;
}

export interface PlatformSettings {
  [key: string]: unknown;
}

export interface UpdateOrgRequest {
  name?: string;
  subscription_tier?: string;
  subscription_status?: string;
  max_users?: number;
  max_sites?: number;
  notes?: string;
}
