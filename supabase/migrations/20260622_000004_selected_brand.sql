-- Adds the `selected_brand` column to patient_medications so users can
-- save their explicit brand choice from the search Smart Picker accordion.
-- Safe to run multiple times.

alter table public.patient_medications
  add column if not exists selected_brand text;

comment on column public.patient_medications.selected_brand is
  'The exact commercial brand string the user selected from the search accordion (e.g. "Codral Day & Night"). NULL = no specific brand chosen.';