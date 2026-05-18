-- 0012_admin_users.sql
-- Database-backed admin allowlist. Service-role reads this table from
-- server-only admin gates; no browser client should be able to enumerate it.

create table if not exists public.admin_users (
  email text primary key,
  active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_lowercase check (email = lower(email))
);

alter table public.admin_users enable row level security;

-- No public RLS policies by design. Service-role bypasses RLS for reads.
create index if not exists admin_users_active_idx
  on public.admin_users (active)
  where active = true;

insert into public.admin_users (email, active, label)
values
  ('tortillabarllc@gmail.com', true, 'temporary gmail break-glass admin'),
  ('admin@pacopeptide.com', true, 'primary domain admin'),
  ('sam@pacopeptide.com', true, 'owner domain admin')
on conflict (email) do update
set
  active = excluded.active,
  label = excluded.label,
  updated_at = now();
