-- 20260604000100_today_users.sql
-- Database-backed Today feature allowlist. Service-role reads this table
-- from server-only Today gates; no browser client should be able to enumerate it.

create table if not exists public.today_users (
  user_id uuid primary key,
  active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.today_users enable row level security;

-- No public RLS policies by design. Service-role bypasses RLS for reads.
create index if not exists today_users_active_idx
  on public.today_users (active)
  where active = true;
