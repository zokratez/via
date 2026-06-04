-- 0015_dose_peptide_name.sql
-- Store the logged peptide name directly on each dose so dose logging
-- works for any peptide, even when there is no legacy medications row.

alter table public.doses
  add column if not exists peptide_name text;

update public.doses d
set peptide_name = coalesce(m.name, 'Unknown peptide')
from public.medications m
where d.medication_id = m.id
  and d.peptide_name is null;

update public.doses
set peptide_name = 'Unknown peptide'
where peptide_name is null;

alter table public.doses
  alter column peptide_name set not null;
