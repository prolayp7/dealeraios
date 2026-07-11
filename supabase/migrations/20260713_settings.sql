-- Dealership settings (Answers §9/Q30) — one row per dealership. Company
-- info and AI/marketplace preferences live in JSONB for flexibility since
-- most of the 10 sections don't need typed columns yet.

BEGIN;

CREATE TABLE IF NOT EXISTS dealership_settings (
  dealership_id UUID PRIMARY KEY REFERENCES dealerships(id) ON DELETE CASCADE,
  company JSONB NOT NULL DEFAULT '{}'::jsonb,
  inactivity_threshold_hours INTEGER NOT NULL DEFAULT 48,
  ai_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  marketplace_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dealership_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealership_isolation" ON dealership_settings;
CREATE POLICY "dealership_isolation" ON dealership_settings
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

COMMIT;
