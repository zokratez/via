-- 0001_init.sql
-- Initial schema for GLP-1 companion app.
-- All tables have RLS enabled. Users can only see/modify their own rows.

-- =========================================
-- profiles (extends auth.users)
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locale text not null default 'es',  -- 'es' | 'en'
  display_name text,
  sex text,                            -- 'm' | 'f' | 'other' | null
  birth_year int,
  height_cm numeric(5,2),
  goal_weight_kg numeric(5,2),
  subscription_tier text not null default 'free',  -- 'free' | 'pro'
  subscription_expires_at timestamptz
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- =========================================
-- medications — a lookup of what the user is on
-- =========================================
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,                  -- 'Ozempic' | 'Wegovy' | 'Mounjaro' | 'Zepbound' | 'Compounded Semaglutide' | etc.
  generic_name text not null,          -- 'semaglutide' | 'tirzepatide' | 'liraglutide'
  concentration_mg_per_ml numeric(6,3),
  is_active boolean not null default true
);

alter table public.medications enable row level security;
create policy "medications_own" on public.medications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- doses — each injection logged
-- =========================================
create table public.doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete set null,
  taken_at timestamptz not null,
  dose_mg numeric(6,3) not null,
  injection_site text,                 -- 'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right' | 'arm_left' | 'arm_right'
  notes text,
  created_at timestamptz not null default now()
);

alter table public.doses enable row level security;
create policy "doses_own" on public.doses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index doses_user_taken_at_idx on public.doses(user_id, taken_at desc);

-- =========================================
-- weight_entries
-- =========================================
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5,2) not null,
  waist_cm numeric(5,2),
  body_fat_pct numeric(4,2),
  created_at timestamptz not null default now()
);

alter table public.weight_entries enable row level security;
create policy "weight_own" on public.weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weight_user_measured_at_idx on public.weight_entries(user_id, measured_at desc);

-- =========================================
-- side_effects
-- =========================================
create table public.side_effects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  category text not null,              -- 'nausea' | 'fatigue' | 'constipation' | 'headache' | 'injection_site' | 'other'
  severity int not null check (severity between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.side_effects enable row level security;
create policy "side_effects_own" on public.side_effects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- coach_threads — chat threads with the AI coach
-- =========================================
create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_threads enable row level security;
create policy "coach_threads_own" on public.coach_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.coach_messages enable row level security;
create policy "coach_messages_own" on public.coach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index coach_messages_thread_idx on public.coach_messages(thread_id, created_at);

-- =========================================
-- usage_counters — for free-tier coach quota
-- =========================================
create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  coach_queries int not null default 0,
  primary key (user_id, day)
);

alter table public.usage_counters enable row level security;
create policy "usage_own" on public.usage_counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- Auto-create profile row on signup
-- =========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'locale', 'es'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
