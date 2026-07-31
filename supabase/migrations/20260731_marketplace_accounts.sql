-- supabase/migrations/20260731_marketplace_accounts.sql
-- Marketplace Accounts (Answers §Marketplace Accounts): replaces the no-op
-- JSONB label array in dealership_settings with real, encrypted, per-account
-- Facebook sessions — each with its own Multilogin browser fingerprint.

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id         UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  platform              TEXT NOT NULL DEFAULT 'facebook',
  auth_method           TEXT NOT NULL DEFAULT 'cookies'
                          CHECK (auth_method IN ('credentials', 'cookies')),
  email                 TEXT,
  encrypted_password    TEXT,
  encrypted_totp_secret TEXT,
  encrypted_cookies     TEXT,
  multilogin_profile_id TEXT,
  multilogin_folder_id  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'blocked', 'error')),
  status_message        TEXT,
  last_login_at         TIMESTAMPTZ,
  last_used_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_dealership_id ON marketplace_accounts(dealership_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_rotation ON marketplace_accounts(dealership_id, status, last_used_at);

ALTER TABLE marketplace_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealership_isolation" ON marketplace_accounts;
CREATE POLICY "dealership_isolation" ON marketplace_accounts
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

ALTER TABLE dealership_settings DROP COLUMN IF EXISTS marketplace_accounts;

COMMIT;
