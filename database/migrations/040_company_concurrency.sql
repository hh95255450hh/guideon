-- Company concurrency capacity: how many tours a company can run at the same
-- time (it has multiple guides). NULL/0 = unlimited. Individual guides ignore
-- this (their capacity is always 1, enforced in bookingService).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "maxConcurrentTours" integer;
