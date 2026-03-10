import type { CustomerProfile, HierarchyTemplateLevel } from "./org";

// ─── Wizard State ───────────────────────────────────────────────────────

export interface SetupOrgInfo {
  orgName: string;
  baseCurrency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface SetupWizardState extends SetupOrgInfo {
  step: number;
  profileId: string | null;
  profile: CustomerProfile | null;
  hierarchyLevels: HierarchyTemplateLevel[];
  selectedCommodities: string[];
  creating: boolean;
  error: string | null;
  createdOrgId: string | null;
}

// ─── API Request / Response ─────────────────────────────────────────────

export interface CreateOrganizationRequest {
  orgName: string;
  baseCurrency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  profileId: string;
  hierarchyLevels: HierarchyTemplateLevel[];
  selectedCommodities: string[];
}

export interface CreateOrganizationResponse {
  org: { id: string; name: string };
  user: { id: string; name: string; email: string };
}

export interface OrgExistsResponse {
  exists: true;
  org: { id: string; name: string };
}

export interface OrgNotExistsResponse {
  exists: false;
}

export type CheckOrgResponse = OrgExistsResponse | OrgNotExistsResponse;
