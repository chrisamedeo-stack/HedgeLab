export type AppRole = "ADMIN" | "RISK_MANAGER" | "TRADER" | "READ_ONLY";

export interface AuthResponse {
  token: string;
  username: string;
  role: AppRole;
  expiresAt: string; // ISO instant
}

export interface LoginRequest {
  username: string;
  password: string;
}
