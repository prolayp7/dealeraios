-- supabase/migrations/20260824_marketplace_accounts_gologin.sql
BEGIN;

ALTER TABLE marketplace_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'multilogin'
    CHECK (provider IN ('multilogin', 'gologin')),
  ADD COLUMN IF NOT EXISTS gologin_profile_id TEXT;

COMMIT;
