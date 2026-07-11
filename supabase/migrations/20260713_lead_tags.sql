-- Unlimited custom lead tags (Answers §5/Q16-Q17). Tags are dealership-scoped
-- and freely created by dealers — the examples (Hot Lead, Negotiating, etc.)
-- are seeded as a starting point, not a fixed list.

BEGIN;

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dealership_id, name)
);

CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_dealership_id ON tags(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_dealership_id ON customer_tags(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON customer_tags(customer_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealership_isolation" ON tags;
CREATE POLICY "dealership_isolation" ON tags
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

DROP POLICY IF EXISTS "dealership_isolation" ON customer_tags;
CREATE POLICY "dealership_isolation" ON customer_tags
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

COMMIT;
