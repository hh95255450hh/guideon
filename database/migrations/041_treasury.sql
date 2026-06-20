-- Treasury: the company's main vault. Manual deposits/withdrawals/sends are
-- recorded here; auto income (platform commission) + expenses are computed.
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id           text PRIMARY KEY,
  type         text NOT NULL,              -- deposit | withdrawal | send
  amount       numeric NOT NULL,
  description  text,
  "payeeId"    text,
  "payeeName"  text,
  "createdAt"  timestamptz DEFAULT now(),
  "createdBy"  text
);
GRANT ALL ON public.treasury_transactions TO anon, authenticated, service_role;
