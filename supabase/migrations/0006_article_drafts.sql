-- 0006_article_drafts.sql
-- LLM-generated article drafts pending Sam review.
--
-- Flow:
--   peptide_research_raw  →  draftArticlesFromResearch()  →  article_drafts (pending_review)
--   Sam reviews via Supabase SQL editor, flips status to 'approved' or 'rejected'
--   Future publish cron picks 'approved' drafts → writes .md → commits to repo → flips to 'published'
--
-- One paper produces two rows (ES + EN). source_pubmed_id ties them back
-- to the originating paper; ON DELETE SET NULL preserves the draft for
-- audit if the raw paper is purged.
--
-- Slug uniqueness is enforced only on published rows (partial unique
-- index). Pending/rejected drafts can share slugs across regeneration
-- cycles; once a draft is published, the slug becomes the canonical URL
-- segment and must not collide.
--
-- RLS: enabled, NO public policies. Service-role only (drafter writes,
-- Sam reviews via Supabase Dashboard which uses service-role identity).

create table public.article_drafts (
  id uuid primary key default gen_random_uuid(),
  source_pubmed_id text
    references public.peptide_research_raw(pubmed_id) on delete set null,
  language text not null check (language in ('es', 'en')),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published')),
  title text not null,
  slug text not null,
  summary text not null,
  body text not null,
  model_used text not null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_commit_sha text,
  published_at timestamptz
);

-- Lookup pattern: "fetch pending drafts, newest first" for review.
create index article_drafts_status_generated_at_idx
  on public.article_drafts (status, generated_at desc);

-- Slug collisions only matter once published. Partial unique index
-- allows the drafter to retry slugs freely until publish time.
create unique index article_drafts_language_slug_published_uniq
  on public.article_drafts (language, slug)
  where status = 'published';

-- RLS on, no public policies. Service role bypasses RLS by default.
alter table public.article_drafts enable row level security;
