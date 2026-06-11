-- ════════════════════════════════════════════════════════════════════
--  Migration 037 — Financial management: expenses / salaries / discounts
-- ════════════════════════════════════════════════════════════════════
--  One ledger table for every money-OUT item the admin records, so the
--  Revenue Dashboard can show net profit = paid revenue − expenses.
--
--  category drives reporting buckets. amount is in OMR (3-decimal).
--  "recurring" marks monthly costs (salaries, rent) so future reports
--  can project them; the actual recurrence expansion happens in app code.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS finance_expenses (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,              -- salary | discount | marketing | operational | refund | commission_payout | tax | rent | software | other
  title         TEXT NOT NULL,             -- short label, e.g. "راتب محمد - يونيو"
  amount        NUMERIC(12,3) NOT NULL,     -- OMR, always positive (it's an outflow)
  currency      TEXT DEFAULT 'OMR',
  "spentAt"     DATE NOT NULL,             -- the date the money left
  recurring     BOOLEAN DEFAULT FALSE,      -- monthly recurring cost (salary, rent…)
  "payee"       TEXT,                       -- who got paid (employee/vendor name)
  "relatedUserId" TEXT,                     -- optional: link to a guide/company (e.g. a payout)
  note          TEXT,
  "createdBy"   TEXT,                       -- admin id who recorded it
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fexp_category ON finance_expenses (category);
CREATE INDEX IF NOT EXISTS idx_fexp_spent    ON finance_expenses ("spentAt" DESC);
CREATE INDEX IF NOT EXISTS idx_fexp_recurring ON finance_expenses (recurring);

ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fexp_all" ON finance_expenses;
CREATE POLICY "fexp_all" ON finance_expenses FOR ALL USING (true) WITH CHECK (true);
