import { describe, expect, test } from "vitest";
import { toSafeAccount, type MarketplaceAccountRow } from "./types";

const fullRow: MarketplaceAccountRow = {
  id: "acc-1",
  dealership_id: "deal-1",
  label: "23 Motorsports — Main",
  platform: "facebook",
  auth_method: "cookies",
  email: null,
  encrypted_password: null,
  encrypted_totp_secret: null,
  encrypted_cookies: "iv:tag:ciphertext",
  multilogin_profile_id: "profile-123",
  multilogin_folder_id: "folder-456",
  status: "active",
  status_message: null,
  last_login_at: "2026-07-31T10:00:00Z",
  last_used_at: "2026-07-31T11:00:00Z",
  created_at: "2026-07-30T09:00:00Z",
  updated_at: "2026-07-31T11:00:00Z",
};

describe("toSafeAccount", () => {
  test("strips every secret-bearing and internal field", () => {
    const safe = toSafeAccount(fullRow);
    expect(safe).toEqual({
      id: "acc-1",
      label: "23 Motorsports — Main",
      platform: "facebook",
      status: "active",
      status_message: null,
      last_login_at: "2026-07-31T10:00:00Z",
      last_used_at: "2026-07-31T11:00:00Z",
      created_at: "2026-07-30T09:00:00Z",
    });
    expect(safe).not.toHaveProperty("encrypted_cookies");
    expect(safe).not.toHaveProperty("dealership_id");
    expect(safe).not.toHaveProperty("multilogin_profile_id");
    expect(safe).not.toHaveProperty("multilogin_folder_id");
  });
});
