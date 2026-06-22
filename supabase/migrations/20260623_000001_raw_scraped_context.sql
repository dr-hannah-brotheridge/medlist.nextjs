-- Add raw_scraped_context column to total_medications for NZF scraper output.
-- This stores the labelled-section text extracted from nzf.org.nz monograph pages,
-- serving as RAG context for GLM-5.2 to generate patient-facing educational content.
-- Idempotent.

alter table public.total_medications
  add column if not exists raw_scraped_context text;

comment on column public.total_medications.raw_scraped_context is
  'Labelled clinical section text scraped from nzf.org.nz monograph pages (Drug action, Cautions, Adverse effects, Dosing regimen, etc.). Used as RAG input context for educational content generation via GLM-5.2. NULL when no NZF monograph was found or scraping was skipped.';