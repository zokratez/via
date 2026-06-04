-- 0017_doses_nullable_medication_id.sql
-- Dose logs now store peptide_name directly. medication_id remains for
-- backward compatibility with legacy GLP-1 medication rows, but is optional.

alter table public.doses
  alter column medication_id drop not null;

