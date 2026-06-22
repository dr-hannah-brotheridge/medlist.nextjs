-- Medication photos feature: table + storage bucket + RLS.
-- Run this in the Supabase SQL Editor (or link/apply via CLI).
-- Safe to run multiple times.

-- ============================================================
-- 1. Table: one row per photo attached to a patient_medication
-- ============================================================
create table if not exists public.medication_photos (
  id uuid primary key default gen_random_uuid(),
  patient_medication_id bigint not null references public.patient_medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- One photo per position per medication (used to order swipe).
create unique index if not exists medication_photos_med_pos_uidx
  on public.medication_photos (patient_medication_id, position);

-- Useful lookups.
create index if not exists medication_photos_by_med_idx
  on public.medication_photos (patient_medication_id);

comment on table public.medication_photos is
  'Photos a user attaches to a patient_medications record (1-4 each).';

-- ============================================================
-- 2. Storage bucket (PRIVATE — access is granted via RLS + signed URLs)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('medication-photos', 'medication-photos', false)
on conflict (id) do nothing;

-- ============================================================
-- 3. Storage RLS policies
-- Path convention: medication-photos/{user_id}/{patient_medication_id}/{filename}
-- A user may only touch objects under their own user_id prefix.
-- ============================================================
alter table storage.objects enable row level security;

-- INSERT: object path must start with the requesting user's id.
drop policy if exists "med-photos-insert" on storage.objects;
create policy "med-photos-insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'medication-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: user can read only their own prefix.
drop policy if exists "med-photos-select" on storage.objects;
create policy "med-photos-select" on storage.objects
  for select to authenticated using (
    bucket_id = 'medication-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE / DELETE: user can only remove/replace their own objects.
drop policy if exists "med-photos-update" on storage.objects;
create policy "med-photos-update" on storage.objects
  for update to authenticated using (
    bucket_id = 'medication-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "med-photos-delete" on storage.objects;
create policy "med-photos-delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'medication-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 4. Table RLS policies
-- ============================================================
alter table public.medication_photos enable row level security;

drop policy if exists "medication_photos_select_own" on public.medication_photos;
create policy "medication_photos_select_own" on public.medication_photos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "medication_photos_insert_own" on public.medication_photos;
create policy "medication_photos_insert_own" on public.medication_photos
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.patient_medications pm
      where pm.id = patient_medication_id
        and pm.user_id = auth.uid()
    )
    and (
      select count(*) from public.medication_photos
      where patient_medication_id = medication_photos.patient_medication_id
    ) < 4
  );

drop policy if exists "medication_photos_update_own" on public.medication_photos;
create policy "medication_photos_update_own" on public.medication_photos
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "medication_photos_delete_own" on public.medication_photos;
create policy "medication_photos_delete_own" on public.medication_photos
  for delete to authenticated using (user_id = auth.uid());