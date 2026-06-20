-- Admin-issued invoices for providers (guides / companies / teams), line items.
CREATE TABLE IF NOT EXISTS public.invoices (
  id             text PRIMARY KEY,
  number         text,
  "recipientId"  text,
  "recipientName" text,
  "recipientType" text,
  items          jsonb,
  subtotal       numeric,
  "vatRate"      numeric,
  vat            numeric,
  total          numeric,
  note           text,
  "createdAt"    timestamptz DEFAULT now(),
  "createdBy"    text
);
GRANT ALL ON public.invoices TO anon, authenticated, service_role;
