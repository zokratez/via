-- 0022_fantasma_trial_started_at.sql
-- Add nullable first-message timestamp for El Fantasma's 24h conversational trial.
--
-- FILE ONLY for SAM-70 piece 3: do not auto-apply.
-- Claude/Sam must verify against production before this migration is applied.
-- RLS is already enabled on public.profiles; existing self-only/service-role
-- patterns cover this profile column, so no policy changes are needed here.

alter table public.profiles
  add column if not exists fantasma_trial_started_at timestamptz;
