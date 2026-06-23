-- Record WHO settled a payout invoice (transferred the money to the provider).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutBy"     TEXT;  -- admin/staff user id
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutByName" TEXT;  -- display name
