-- Airtable live two-way sync: vehicle linkage columns, a few fields the
-- client's real Airtable base has that this schema didn't (Color, CODE,
-- Where, Sold Date), and the per-dealership Airtable connection config.

BEGIN;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS airtable_record_id TEXT,
  ADD COLUMN IF NOT EXISTS airtable_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS lot_location TEXT,
  ADD COLUMN IF NOT EXISTS sold_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_dealership_airtable_record
  ON vehicles (dealership_id, airtable_record_id)
  WHERE airtable_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION set_vehicles_updated_at();

ALTER TABLE dealership_settings
  ADD COLUMN IF NOT EXISTS airtable_config JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "personal_access_token": "",
    "base_id": "",
    "table_name": "",
    "last_modified_field": "Last Modified",
    "column_mapping": {},
    "last_synced_at": null,
    "last_sync_error": null
  }'::jsonb;

COMMIT;
