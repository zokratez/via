-- Private saved AI progress-photo comparison reports.
-- Reports are user-scoped and refer back to the two compared photos.

create table public.progress_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_photo_id uuid not null references public.progress_photos(id) on delete cascade,
  latest_photo_id uuid not null references public.progress_photos(id) on delete cascade,
  angle text not null,
  summary text not null,
  visible_changes text[] not null default '{}',
  consistency_notes text[] not null default '{}',
  questions_for_clinician text[] not null default '{}',
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index progress_analyses_user_created_at_idx
  on public.progress_analyses(user_id, created_at desc);

create index progress_analyses_photo_pair_idx
  on public.progress_analyses(user_id, previous_photo_id, latest_photo_id);

alter table public.progress_analyses enable row level security;

create policy "progress_analyses_own"
  on public.progress_analyses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete
  on public.progress_analyses
  to authenticated;
