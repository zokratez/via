-- 0013_harden_reviews_submission.sql
-- Review submission now writes through a server-side service-role action.
-- Public clients should not be able to insert moderation-controlled rows
-- or upload arbitrary files into the public receipts bucket directly.

drop policy if exists "user_reviews_public_insert" on public.user_reviews;

drop policy if exists "receipts_public_insert" on storage.objects;

-- Newsletter submissions also go through /api/newsletter so the app can
-- normalize email, validate locale, and absorb duplicate inserts.
drop policy if exists "newsletter_signups_public_insert" on public.newsletter_signups;
