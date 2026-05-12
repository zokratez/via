-- 0005_peptide_research_raw.sql
-- Storage for the daily PubMed peptide research scraper.
--
-- This table is the foundation layer of a multi-source research
-- pipeline (Reddit, X, RSS, conferences in future commits). The
-- scraper runs daily via Vercel cron, hits PubMed E-utilities, and
-- inserts new articles deduplicated by pubmed_id.
--
-- No drafting/filtering/UI layer in this commit. Pure ingest.
--
-- RLS: enabled with NO public policies. Only service_role bypasses
-- RLS, so the scraper (which uses SUPABASE_SERVICE_ROLE_KEY) can
-- write. No anon or authenticated user can read — this is internal
-- research data, not user-facing content.

create table public.peptide_research_raw (
  id uuid primary key default gen_random_uuid(),
  pubmed_id text unique not null,
  title text not null,
  abstract text,
  authors text[] not null default array[]::text[],
  journal text,
  published_date date,
  url text not null,
  peptides_matched text[] not null,
  created_at timestamptz not null default now()
);

-- Index for sorting newest-first when we later build a review UI.
create index peptide_research_raw_published_date_idx
  on public.peptide_research_raw (published_date desc);

-- RLS on, no public policies. Service role bypasses RLS by default.
alter table public.peptide_research_raw enable row level security;
