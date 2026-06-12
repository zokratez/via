-- 0022_fantasma_trial_started_at.sql
-- Add El Fantasma conversational trial fields.
--
-- FILE ONLY for SAM-70 piece 3: do not auto-apply.
-- Claude/Sam must verify against production before this migration is applied.
-- RLS is already enabled on public.profiles; existing self-only/service-role
-- patterns cover this profile column, so no policy changes are needed here.
--
-- Trial policy: the observer card stays free; conversational El Fantasma gets
-- a 3-message taste for non-Pro users. `fantasma_trial_started_at` is stamped
-- on first message for analytics; `fantasma_trial_messages_used` is incremented
-- only after a successful model response.

alter table public.profiles
  add column if not exists fantasma_trial_started_at timestamptz,
  add column if not exists fantasma_trial_messages_used int not null default 0;
