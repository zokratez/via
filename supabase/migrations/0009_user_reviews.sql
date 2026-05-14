-- 0009_user_reviews.sql
-- Public review submission with admin moderation gate.
--
-- RLS allows anon + authenticated to INSERT only; SELECT/UPDATE/DELETE
-- are blocked from public roles. The /admin/reviews surface uses the
-- service role to read and update. The homepage display section
-- (commit 2) also reads via service role through a server fetch since
-- only approved+verified rows should be exposed publicly.
--
-- user_id is nullable: anonymous reviews are allowed. Logged-in users
-- get their auth.users.id attached for cross-reference. ON DELETE
-- SET NULL preserves the review even if the user account is deleted.

create table public.user_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  receipt_image_url text,
  verified boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  locale text not null check (locale in ('es', 'en')),
  created_at timestamptz not null default now()
);

create index user_reviews_status_created_at_idx
  on public.user_reviews(status, created_at desc);

alter table public.user_reviews enable row level security;

create policy "user_reviews_public_insert"
  on public.user_reviews
  for insert
  to anon, authenticated
  with check (true);

-- =========================================
-- Storage: receipts bucket
-- =========================================
-- Receipt image attachments. Public bucket so URLs work without
-- signing; the public site only surfaces URLs of approved reviews,
-- so unapproved receipts remain in storage but unlinked.
--
-- NOTE: storage policies via SQL may require the postgres role on
-- some Supabase projects. If `create policy` on storage.objects
-- fails, recreate the policies via the Supabase Dashboard
-- (Storage → receipts → Policies).

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "receipts_public_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'receipts');

create policy "receipts_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'receipts');
