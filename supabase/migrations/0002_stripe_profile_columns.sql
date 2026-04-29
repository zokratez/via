-- 0002_stripe_profile_columns.sql
-- Add Stripe linkage columns to profiles for web subscription billing.
-- RLS is already enabled on public.profiles; existing self-only policies
-- cover the new columns, so no policy changes are needed here.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_price_id text;

-- Index used to look up profile rows from Stripe webhook events
-- (which arrive with cus_... but no Supabase user id).
create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;
