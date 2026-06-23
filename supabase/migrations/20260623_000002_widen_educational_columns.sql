-- Widen the 9 educational clinical columns from VARCHAR(100) to TEXT.
--
-- Background: build-educational-db.js asks GLM-5.2 for 1-2 short clinical
-- sentences per field (per the NZF translation-table System Prompt). Those
-- sentences routinely exceed 100 characters (e.g. the standard stop-warning
-- "Your blood pressure may rise again. Do not stop without consulting your
-- doctor." is 80 chars alone). VARCHAR(100) caused every live write to fail
-- with "value too long for type character varying(100)".
--
-- TEXT has no fixed limit in PostgreSQL and is the idiomatic choice for
-- free-form clinical explanations. This migration is non-destructive:
-- existing data is preserved (just re-typed).
--
-- Apply via: Supabase Dashboard → SQL Editor, OR run:
--   node scripts/apply-widen-migration.js

ALTER TABLE public.total_medications
  ALTER COLUMN drug_class TYPE TEXT,
  ALTER COLUMN why_it_is_prescribed TYPE TEXT,
  ALTER COLUMN what_it_does_in_the_body TYPE TEXT,
  ALTER COLUMN what_organ_or_condition_it_protects TYPE TEXT,
  ALTER COLUMN what_happens_if_you_stop_it TYPE TEXT,
  ALTER COLUMN common_dose_range TYPE TEXT,
  ALTER COLUMN side_effects TYPE TEXT,
  ALTER COLUMN what_symptoms_to_watch_for TYPE TEXT,
  ALTER COLUMN when_to_seek_help TYPE TEXT;