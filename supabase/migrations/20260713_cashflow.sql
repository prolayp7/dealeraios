-- Cashflow ledger (Answers §10/Q31-Q32) — becomes the real backing data for
-- the Command Center's Available Cash widget, replacing the Day 1 proxy that
-- only looked at vehicle purchase/sale events.

BEGIN;

CREATE TABLE IF NOT EXISTS cashflow_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'vehicle_purchase', 'vehicle_sale', 'repair', 'transport', 'insurance',
    'rent', 'payroll', 'advertising', 'auction_fee', 'misc'
  )),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashflow_dealership_id ON cashflow_transactions(dealership_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_transaction_date ON cashflow_transactions(transaction_date);

ALTER TABLE cashflow_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealership_isolation" ON cashflow_transactions;
CREATE POLICY "dealership_isolation" ON cashflow_transactions
  FOR ALL USING (dealership_id = current_dealership_id())
  WITH CHECK (dealership_id = current_dealership_id());

-- Backfill: every existing vehicle's purchase/repair cost becomes a ledger
-- entry, and any vehicle already marked "sold" becomes a sale entry, so the
-- ledger reflects real history instead of starting at zero on cutover.
INSERT INTO cashflow_transactions (dealership_id, vehicle_id, type, amount, description, transaction_date)
SELECT dealership_id, id, 'vehicle_purchase', my_cost, make || ' ' || model || ' purchase', COALESCE(bought_date, created_at::date)
FROM vehicles
WHERE my_cost IS NOT NULL AND my_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM cashflow_transactions ct WHERE ct.vehicle_id = vehicles.id AND ct.type = 'vehicle_purchase'
  );

INSERT INTO cashflow_transactions (dealership_id, vehicle_id, type, amount, description, transaction_date)
SELECT dealership_id, id, 'repair', repair_cost, make || ' ' || model || ' repairs', COALESCE(bought_date, created_at::date)
FROM vehicles
WHERE repair_cost IS NOT NULL AND repair_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM cashflow_transactions ct WHERE ct.vehicle_id = vehicles.id AND ct.type = 'repair'
  );

INSERT INTO cashflow_transactions (dealership_id, vehicle_id, type, amount, description, transaction_date)
SELECT dealership_id, id, 'vehicle_sale', retail_price, make || ' ' || model || ' sale', created_at::date
FROM vehicles
WHERE status ILIKE 'sold' AND retail_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cashflow_transactions ct WHERE ct.vehicle_id = vehicles.id AND ct.type = 'vehicle_sale'
  );

COMMIT;
