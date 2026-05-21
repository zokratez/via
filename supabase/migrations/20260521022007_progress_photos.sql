-- Private progress photos.
-- Users can upload, view, and delete only their own progress photos.
-- No public bucket URLs: the app uses short-lived signed URLs.

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  storage_path text not null unique,
  angle text not null default 'front'
    check (angle in ('front', 'side', 'back', 'face', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create index progress_photos_user_captured_at_idx
  on public.progress_photos(user_id, captured_at desc);

alter table public.progress_photos enable row level security;

create policy "progress_photos_own"
  on public.progress_photos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete
  on public.progress_photos
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "progress_photos_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
