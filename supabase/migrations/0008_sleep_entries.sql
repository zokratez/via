-- 0008_sleep_entries.sql
-- Sleep tracking. Per-night entry: hours + quality + optional notes.
--
-- One row per night. slept_at is a date (not timestamptz) — sleep
-- belongs to a calendar night, not a precise moment. Multiple entries
-- per date are allowed (no unique constraint on user+date) so a user
-- can log naps separately if they want, though the chart aggregates
-- by date.
--
-- RLS: same pattern as doses/weight_entries/side_effects — user can
-- only see/modify their own rows.

create table public.sleep_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slept_at date not null,
  hours numeric(4,2) not null check (hours >= 0 and hours <= 24),
  quality int not null check (quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index sleep_entries_user_slept_at_idx
  on public.sleep_entries(user_id, slept_at desc);

alter table public.sleep_entries enable row level security;
create policy "sleep_own" on public.sleep_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
