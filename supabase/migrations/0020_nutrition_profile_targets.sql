-- 0020_nutrition_profile_targets.sql
-- Add nullable nutrition targets to profiles for SAM-46.
--
-- These live on the profile because current product scope does not need
-- historical goal versions. A null target is a real state: the UI should
-- show "set your goal" rather than treating missing targets as zero.
-- RLS is already enabled on public.profiles; existing self-only policies
-- cover these columns, so no policy changes are needed here.

alter table public.profiles
  add column if not exists daily_calorie_target integer,
  add column if not exists protein_target_g integer,
  add column if not exists carbs_target_g integer,
  add column if not exists fat_target_g integer,
  add column if not exists nutrition_goal_type text,
  add column if not exists nutrition_targets_source text;
