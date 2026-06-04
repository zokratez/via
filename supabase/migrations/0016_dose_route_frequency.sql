-- 0016_dose_route_frequency.sql
-- Peptide dose logs need to capture actual cadence and administration route.
-- Defaults preserve existing GLP-1 weekly injection behavior for old rows.

alter table public.doses
  add column if not exists frequency text,
  add column if not exists frequency_detail text,
  add column if not exists route text;

update public.doses
set frequency = 'weekly'
where frequency is null;

