-- =========================================
-- water_entries
-- =========================================
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  drank_at timestamptz not null default now(),
  amount_ml numeric(7,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.water_entries enable row level security;
create policy "water_own" on public.water_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index water_user_drank_at_idx on public.water_entries(user_id, drank_at desc);
