-- 0007_newsletter_signups.sql
-- Public newsletter capture surface.
--
-- Captures email + locale at signup time. No sending pipeline yet —
-- this is just the capture table. RLS allows INSERT from anon and
-- authenticated; SELECT/UPDATE/DELETE all blocked from public roles.
-- Only the service role (operator/Sam) can read the list.
--
-- Duplicate emails error with unique_violation (23505); the
-- /api/newsletter route swallows that and returns success to the
-- caller so we don't leak whether an address is already on the list.

create table public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text not null check (locale in ('es', 'en')),
  created_at timestamptz not null default now()
);

create index newsletter_signups_created_at_idx
  on public.newsletter_signups (created_at desc);

alter table public.newsletter_signups enable row level security;

create policy "newsletter_signups_public_insert"
  on public.newsletter_signups
  for insert
  to anon, authenticated
  with check (true);
