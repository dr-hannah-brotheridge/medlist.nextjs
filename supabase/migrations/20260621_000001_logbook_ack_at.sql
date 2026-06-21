-- Adds a durable, per-account record of the one-time "digital logbook"
-- acknowledgment shown before the Medication Details form.
-- Safe to run multiple times.

alter table public.patient_details
  add column if not exists logbook_ack_at timestamptz;

comment on column public.patient_details.logbook_ack_at is
  'Timestamp the user acknowledged that MedList is a manual digital logbook (one-time gate before adding medications). NULL = not yet acknowledged.';
