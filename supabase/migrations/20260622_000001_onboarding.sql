-- Onboarding flow state for the 4-step wizard shown the first time a user
-- enters the authenticated app. Safe to run multiple times.

alter table public.patient_details
  add column if not exists onboarded_at timestamptz;

alter table public.patient_details
  add column if not exists caregiver_role text;

comment on column public.patient_details.onboarded_at is
  'Timestamp the user completed the onboarding wizard. NULL = not yet onboarded (layout will redirect to /onboarding).';

comment on column public.patient_details.caregiver_role is
  'Who the user manages medications for. One of: ''myself'', ''caregiver''. Set during onboarding step 2.';