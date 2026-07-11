-- Acquisition Brain (Answers §11): passively-discovered marketplace
-- opportunities the dealer hasn't engaged with yet, each scored BUY/WATCH/
-- PASS/RUN. Distinct from AI Appraiser, which evaluates a vehicle the dealer
-- already has or is actively considering.

BEGIN;

CREATE TABLE IF NOT EXISTS acquisition_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  title TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  mileage INTEGER,
  asking_price NUMERIC(12, 2),
  location TEXT,
  url TEXT,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('BUY', 'WATCH', 'PASS', 'RUN')),
  max_buy_price NUMERIC(12, 2),
  expected_profit NUMERIC(12, 2),
  expected_roi NUMERIC(8, 2),
  notes TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acquisition_dealership_id ON acquisition_opportunities(dealership_id);

ALTER TABLE acquisition_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealership_isolation" ON acquisition_opportunities;
CREATE POLICY "dealership_isolation" ON acquisition_opportunities
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

COMMIT;
