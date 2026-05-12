-- 0004_subscription_tier_extended.sql
-- Extend profiles.subscription_tier to allow trialing + past_due_grace.
--
-- Background: today the column comment in 0001_init.sql says
-- "'free' | 'pro'" but no DB-level CHECK constraint enforces it. The
-- reverse-trial paywall (see SCOPE_PROPOSAL.md) introduces two new
-- legal values: 'trialing' (inside the Stripe 7-day trial window) and
-- 'past_due_grace' (short grace period after a failed payment).
--
-- This migration adds the constraint explicitly so the schema is the
-- source of truth for legal tier values going forward.
--
-- Backward compat: existing rows are 'free' or 'pro' (per the 0001
-- default + Day 5 webhook writes). Both pass the new check. The
-- column default 'free' is unchanged. RLS is already enabled on
-- public.profiles (0001_init.sql:22) and existing self-only policies
-- cover this column unchanged.

alter table public.profiles
  add constraint profiles_subscription_tier_chk
  check (subscription_tier in ('free', 'pro', 'trialing', 'past_due_grace'));
