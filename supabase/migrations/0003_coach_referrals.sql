-- 0003_coach_referrals.sql
-- Operator-managed referral list. Bukowski surfaces these via the
-- Supabase service role only when REFERRAL_REQUEST intent fires in
-- /api/coach. Sam adds rows manually after vetting and consent;
-- default active=false ensures nothing appears until he flips the
-- flag.

create table public.coach_referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  active boolean not null default false,
  name text not null,
  credentials text not null,
  specialty text not null,
  scope_notes text,
  languages text[] not null default '{en}',
  telehealth_states text[] not null default '{}',
  countries text[] not null default '{US}',
  url text,
  consent_documented boolean not null default false,
  vetted_at timestamptz,
  notes_internal text
);

create index coach_referrals_active_languages_idx
  on public.coach_referrals(active, languages);

-- RLS: enabled, no anon/authenticated policies. The Supabase service
-- role bypasses RLS by default, so the API route still reads via
-- SUPABASE_SERVICE_ROLE_KEY. Public clients see nothing.
alter table public.coach_referrals enable row level security;
