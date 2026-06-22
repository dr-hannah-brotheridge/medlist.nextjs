-- Backfill total_medications.brands from the normalised nzulm_lookup table.
-- Run AFTER applying 000002 (nzulm_lookup) AND AFTER running import-nzulm.js.
-- Safe to run multiple times.
--
-- Architecture:
--   total_medications.medication_name  <-- the cleaned GENERIC name (Pass 1 of import)
--   nzulm_lookup.generic_medication_id -- FK -> total_medications.id
--   nzulm_lookup.brand_name            -- one normalised row per trade brand
--   total_medications.brands           -- denormalised display string (read by frontend)
--
-- This function recomputes .brands from nzulm_lookup so every existing
-- frontend query (SearchList, search/[id], my-meds, summary, PDF) works
-- with zero code changes.

create or replace function public.refresh_brands_from_lookup()
returns void
language sql
as $$
  update public.total_medications tm
  set brands = agg.brand_list
  from (
    select
      generic_medication_id,
      string_agg(distinct brand_name, ', ' order by brand_name) as brand_list
    from public.nzulm_lookup
    group by generic_medication_id
  ) agg
  where agg.generic_medication_id = tm.id;
$$;

comment on function public.refresh_brands_from_lookup() is
  'Recomputes total_medications.brands from nzulm_lookup. Call after each import-nzulm.js run.';

-- Run once now so the first import is immediately reflected in the frontend.
select public.refresh_brands_from_lookup();