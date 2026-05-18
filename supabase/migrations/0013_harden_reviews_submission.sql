-- 0013_harden_reviews_submission.sql
-- Review submission now writes through a server-side service-role action.
-- Public clients should not be able to insert moderation-controlled rows
-- or upload arbitrary files into the public receipts bucket directly.

drop policy if exists "user_reviews_public_insert" on public.user_reviews;

drop policy if exists "receipts_public_insert" on storage.objects;
