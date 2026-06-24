-- Move medications whose name starts with a digit to the bottom of the list
-- so the UI starts at "A" and looks cleaner.
--
-- Approach: add a `sort_key` column. Names starting with [0-9] get a sort_key
-- prefixed with 'ZZ' so they sort after every letter. All other names use
-- the medication_name itself as the sort_key (so A-Z ordering is unchanged).
--
-- The search page (app/(app)/search/page.tsx) was updated to ORDER BY sort_key.
--
-- Apply via: Supabase Dashboard → SQL Editor, paste and Run.
-- Idempotent: safe to run multiple times.

-- Step 1: Add the sort_key column if it doesn't exist.
ALTER TABLE public.total_medications
  ADD COLUMN IF NOT EXISTS sort_key TEXT;

-- Step 2: Populate sort_key for rows starting with a digit.
-- Uses a regex match anchored at the start of the string.
UPDATE public.total_medications
SET sort_key = 'ZZ' || medication_name
WHERE medication_name ~ '^[0-9]'
  AND (sort_key IS NULL OR sort_key <> 'ZZ' || medication_name);

-- Step 3: Populate sort_key for everything else (letter or symbol start).
UPDATE public.total_medications
SET sort_key = medication_name
WHERE medication_name !~ '^[0-9]'
  AND (sort_key IS NULL OR sort_key <> medication_name);

-- Step 4: Backfill any remaining NULLs (defensive — shouldn't be any).
UPDATE public.total_medications
SET sort_key = medication_name
WHERE sort_key IS NULL;

-- Step 5: Index sort_key for faster ORDER BY on the search page.
CREATE INDEX IF NOT EXISTS idx_total_medications_sort_key
  ON public.total_medications (sort_key);

-- Step 6: Verify the result (safe to comment out in production).
-- SELECT medication_name, sort_key
-- FROM public.total_medications
-- ORDER BY sort_key ASC
-- LIMIT 20;

-- NOTE: If the `medications_by_name` view exists and you want it to use the
-- new ordering, recreate it. The view is optional for the app; the search
-- page queries the table directly.