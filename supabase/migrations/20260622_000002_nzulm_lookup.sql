-- NZULM relational lookup table + trigram text indexes for sub-30ms typing lookups.
-- Safe to run multiple times.
-- Layers 1 & 2 of the NZULM integration: total_medications stays as the Master
-- Educational Repository; nzulm_lookup is the secondary relational brand table.

-- 1. Enable the pg_trgm extension (required for GIN trigram indexes / ILIKE acceleration).
create extension if not exists pg_trgm;

-- 2. Secondary relational lookup table: brand_name -> generic_medication_id link.
create table if not exists public.nzulm_lookup (
  id bigint generated always as identity primary key,
  generic_medication_id bigint not null
    references public.total_medications (id) on delete cascade,
  brand_name text not null,
  concept_id text
);

comment on table public.nzulm_lookup is
  'NZULM trade/brand entries. Each row links a commercial brand_name to its parent generic medication (total_medications.id) and stores the unique NZULM concept_id.';

comment on column public.nzulm_lookup.generic_medication_id is
  'FK to total_medications.id (the generic / master educational row). ON DELETE CASCADE.';
comment on column public.nzulm_lookup.brand_name is
  'Commercial brand display string (cleaned of manufacturer indicators and dosing metrics).';
comment on column public.nzulm_lookup.concept_id is
  'Unique NZULM identifier for this term (text, as imported from the CSV).';

-- 3. B-tree indexes for FK joins + concept_id lookups.
create index if not exists nzulm_lookup_generic_medication_id_idx
  on public.nzulm_lookup (generic_medication_id);
create index if not exists nzulm_lookup_concept_id_idx
  on public.nzulm_lookup (concept_id);

-- 4. GIN (Generalized Inverted Index) trigram indexes for sub-30ms typing lookups.
create index if not exists nzulm_lookup_brand_name_trgm_idx
  on public.nzulm_lookup using gin (brand_name gin_trgm_ops);
create index if not exists total_medications_medication_name_trgm_idx
  on public.total_medications using gin (medication_name gin_trgm_ops);