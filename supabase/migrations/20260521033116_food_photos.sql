-- Private food photos and meal notes.
-- Phase 1 stores private user photos and user-entered nutrition context.
-- AI calorie/macro estimates can be layered on top later.

create table public.food_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  storage_path text not null unique,
  meal_type text not null default 'meal'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'meal')),
  description text,
  calories_estimate int check (calories_estimate is null or calories_estimate between 0 and 10000),
  protein_g numeric(6,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(6,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(6,2) check (fat_g is null or fat_g >= 0),
  created_at timestamptz not null default now()
);

create index food_photos_user_eaten_at_idx
  on public.food_photos(user_id, eaten_at desc);

alter table public.food_photos enable row level security;

create policy "food_photos_own"
  on public.food_photos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete
  on public.food_photos
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-photos',
  'food-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "food_photos_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'food-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "food_photos_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'food-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "food_photos_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'food-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
