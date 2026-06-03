-- 0014_user_peptides.sql
-- User-scoped custom peptide names for dose logging suggestions.

create table public.user_peptides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_freq text not null default 'custom',
  default_unit text not null default 'mg',
  created_at timestamptz not null default now()
);

create unique index user_peptides_user_lower_name_idx
  on public.user_peptides(user_id, lower(name));

create index user_peptides_user_created_at_idx
  on public.user_peptides(user_id, created_at desc);

alter table public.user_peptides enable row level security;
create policy "user_peptides_own" on public.user_peptides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
