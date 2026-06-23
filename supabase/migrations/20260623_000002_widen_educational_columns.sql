-- Widen the 9 educational clinical columns from VARCHAR(100) to TEXT.
--
-- Background: build-educational-db.js asks GLM-5.2 for 1-2 short clinical
-- sentences per field (per the NZF translation-table System Prompt). Those
-- sentences routinely exceed 100 characters. VARCHAR(100) caused every live
-- write to fail with "value too long for type character varying(100)".
--
-- TEXT has no fixed limit in PostgreSQL and is the idiomatic choice for
-- free-form clinical explanations. This migration is non-destructive:
-- existing data is preserved (just re-typed).
--
-- NOTE: PostgreSQL cannot ALTER a column's type while a VIEW depends on it.
-- The view `medications_by_name` depends on these columns, so we must drop
-- it, alter the columns, then recreate it.
--
-- Apply via: Supabase Dashboard → SQL Editor, paste and Run.

-- Step 1: Drop the dependent view.
DROP VIEW IF EXISTS public.medications_by_name;

-- Step 2: Widen all 9 columns to TEXT.
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

-- Step 3: Recreate the view with its original definition.
CREATE OR REPLACE VIEW public.medications_by_name AS
SELECT id,
    medication_name,
    drug_class,
    why_it_is_prescribed,
    what_it_does_in_the_body,
    what_organ_or_condition_it_protects,
    what_happens_if_you_stop_it,
    common_dose_range,
    side_effects,
    what_symptoms_to_watch_for,
    when_to_seek_help,
    brands
FROM total_medications
ORDER BY medication_name;

-- Step 4: Restore permissions (views lose grants when dropped).
GRANT SELECT ON public.medications_by_name TO anon;
GRANT SELECT ON public.medications_by_name TO authenticated;