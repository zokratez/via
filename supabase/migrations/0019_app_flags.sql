-- 0019_app_flags.sql
-- Server-side feature flags. Service-role reads this table from server-only
-- gates; no browser client should be able to enumerate flags.

create table if not exists public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_flags enable row level security;

-- No public RLS policies by design. Service-role bypasses RLS for reads.
