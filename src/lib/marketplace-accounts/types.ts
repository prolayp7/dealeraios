export interface MarketplaceAccountRow {
  id: string;
  dealership_id: string;
  label: string;
  platform: string;
  auth_method: "cookies" | "credentials";
  email: string | null;
  encrypted_password: string | null;
  encrypted_totp_secret: string | null;
  encrypted_cookies: string | null;
  multilogin_profile_id: string | null;
  multilogin_folder_id: string | null;
  status: "pending" | "active" | "blocked" | "error";
  status_message: string | null;
  last_login_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeMarketplaceAccount {
  id: string;
  label: string;
  platform: string;
  status: MarketplaceAccountRow["status"];
  status_message: string | null;
  last_login_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export function toSafeAccount(row: MarketplaceAccountRow): SafeMarketplaceAccount {
  return {
    id: row.id,
    label: row.label,
    platform: row.platform,
    status: row.status,
    status_message: row.status_message,
    last_login_at: row.last_login_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  };
}
