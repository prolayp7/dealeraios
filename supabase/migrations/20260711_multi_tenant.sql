-- Multi-tenant retrofit: dealerships, profiles, dealership_id on all tenant-scoped
-- tables, RLS isolation. See docs/superpowers/specs/2026-07-03-supabase-foundation-design.md.
--
-- Seeds a "23 Motorsports" dealership and links it to an admin profile for the
-- auth user already created via the Admin API (id below). Existing demo rows in
-- vehicles/market_comps/customers/messages/customer_inquiries are backfilled to
-- that dealership.

BEGIN;

-- 1. Core tenant tables ------------------------------------------------------

CREATE TABLE IF NOT EXISTS dealerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  full_name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. dealership_id on every existing tenant-scoped table ---------------------

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id);
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id);
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id);

-- 3. Seed "23 Motorsports" + link the admin auth user -------------------------
-- Defensive guard: abort if this has already been run (dealership already exists).

DO $$
DECLARE
  v_dealership_id UUID;
  v_admin_user_id UUID := '38d8d6c8-ffa6-43b4-bdd0-3d4d1064fd57';
  v_already_migrated BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM dealerships WHERE name = '23 Motorsports') INTO v_already_migrated;

  IF v_already_migrated THEN
    RAISE NOTICE 'Migration already applied — 23 Motorsports dealership exists. Skipping seed/backfill.';
  ELSE
    INSERT INTO dealerships (name) VALUES ('23 Motorsports')
    RETURNING id INTO v_dealership_id;

    INSERT INTO profiles (id, dealership_id, role, email)
    VALUES (v_admin_user_id, v_dealership_id, 'admin', 'prolaypanda7@gmail.com')
    ON CONFLICT (id) DO NOTHING;

    -- Backfill existing demo rows. Abort if any row is already tagged elsewhere
    -- (guards against double-running against a partially-migrated database).
    IF EXISTS (SELECT 1 FROM vehicles WHERE dealership_id IS NOT NULL AND dealership_id != v_dealership_id)
      OR EXISTS (SELECT 1 FROM market_comps WHERE dealership_id IS NOT NULL AND dealership_id != v_dealership_id)
      OR EXISTS (SELECT 1 FROM customers WHERE dealership_id IS NOT NULL AND dealership_id != v_dealership_id)
      OR EXISTS (SELECT 1 FROM messages WHERE dealership_id IS NOT NULL AND dealership_id != v_dealership_id)
      OR EXISTS (SELECT 1 FROM customer_inquiries WHERE dealership_id IS NOT NULL AND dealership_id != v_dealership_id)
    THEN
      RAISE EXCEPTION 'Rows already tagged with a different dealership_id — aborting to avoid corrupting existing tenant data.';
    END IF;

    UPDATE vehicles SET dealership_id = v_dealership_id WHERE dealership_id IS NULL;
    UPDATE market_comps SET dealership_id = v_dealership_id WHERE dealership_id IS NULL;
    UPDATE customers SET dealership_id = v_dealership_id WHERE dealership_id IS NULL;
    UPDATE messages SET dealership_id = v_dealership_id WHERE dealership_id IS NULL;
    UPDATE customer_inquiries SET dealership_id = v_dealership_id WHERE dealership_id IS NULL;
  END IF;
END $$;

-- 4. Enforce NOT NULL now that every row is backfilled ------------------------

ALTER TABLE vehicles ALTER COLUMN dealership_id SET NOT NULL;
ALTER TABLE market_comps ALTER COLUMN dealership_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN dealership_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN dealership_id SET NOT NULL;
ALTER TABLE customer_inquiries ALTER COLUMN dealership_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_dealership_id ON vehicles(dealership_id);
CREATE INDEX IF NOT EXISTS idx_market_comps_dealership_id ON market_comps(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customers_dealership_id ON customers(dealership_id);
CREATE INDEX IF NOT EXISTS idx_messages_dealership_id ON messages(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_dealership_id ON customer_inquiries(dealership_id);

-- 5. current_dealership_id() helper -------------------------------------------

CREATE OR REPLACE FUNCTION current_dealership_id() RETURNS UUID AS $$
  SELECT dealership_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Swap open policies for tenant-isolation policies --------------------------

ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to vehicles" ON vehicles;
DROP POLICY IF EXISTS "dealership_isolation" ON vehicles;
CREATE POLICY "dealership_isolation" ON vehicles
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

DROP POLICY IF EXISTS "Allow all access to market_comps" ON market_comps;
DROP POLICY IF EXISTS "dealership_isolation" ON market_comps;
CREATE POLICY "dealership_isolation" ON market_comps
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

DROP POLICY IF EXISTS "Allow all access to customers" ON customers;
DROP POLICY IF EXISTS "dealership_isolation" ON customers;
CREATE POLICY "dealership_isolation" ON customers
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
DROP POLICY IF EXISTS "dealership_isolation" ON messages;
CREATE POLICY "dealership_isolation" ON messages
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

DROP POLICY IF EXISTS "Allow all access to customer_inquiries" ON customer_inquiries;
DROP POLICY IF EXISTS "dealership_isolation" ON customer_inquiries;
CREATE POLICY "dealership_isolation" ON customer_inquiries
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

-- dealerships: any authenticated member of a dealership can read their own row.
DROP POLICY IF EXISTS "same_dealership_read" ON dealerships;
CREATE POLICY "same_dealership_read" ON dealerships
  FOR SELECT USING (id = current_dealership_id());

-- profiles: a user can read/update their own row; any member of the same
-- dealership can read the roster (so admins can list their staff).
DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "same_dealership_read" ON profiles;
CREATE POLICY "same_dealership_read" ON profiles
  FOR SELECT USING (dealership_id = current_dealership_id());

COMMIT;
