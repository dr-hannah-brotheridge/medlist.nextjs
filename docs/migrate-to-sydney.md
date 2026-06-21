# Migrating MedList's Supabase project to Sydney (ap-southeast-2)

**Why:** NHI numbers + prescription data are health information under the NZ Privacy
Act 2020 / Health Information Privacy Code 2020 (IPP 12). Supabase has no NZ region;
**`ap-southeast-2` (Sydney)** is the closest Oceania node and the recommended target.

A Supabase project's region **cannot be changed in place** — you create a *new*
project in Sydney and migrate data into it, then cut the app over. This is a runbook
to follow when you're ready; nothing here runs automatically.

> Official reference (check for the latest flags before running):
> https://supabase.com/docs/guides/platform/migrating-and-upgrading-projects

---

## 0. Prerequisites (once)

```bash
# Supabase CLI
npm install -g supabase            # or: brew install supabase/tap/supabase
supabase --version

# Postgres client tools v15+ (pg_dump / psql) — must be >= the server's major version
# macOS:  brew install postgresql@16
# Windows: install from https://www.postgresql.org/download/windows/
psql --version
```

Get the two **direct** database connection strings (Supabase → **Project Settings →
Database → Connection string → URI**, the direct connection, not the transaction pooler).
They look like:
`postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres`

```bash
export OLD_DB_URL="postgresql://postgres:...@db.lbdjjadraskhbqlcpgtt.supabase.co:5432/postgres"   # current (US)
export NEW_DB_URL="postgresql://postgres:...@db.<new-ref>.supabase.co:5432/postgres"               # new (Sydney)
```

---

## 1. Create the new project

In the Supabase dashboard → **New project** → Region: **South East Asia (Sydney) /
ap-southeast-2**. Note the new project ref, anon key, and service-role key (Settings → API).

---

## 2. Dump the old project (roles → schema → data)

Run from an empty working folder. This captures `public` **and** `auth`/`storage`
schemas, including users (hashed passwords), RLS policies, the `total_medications`
reference data (415 rows), `patient_details`, `patient_medications`, the
`user_medication_counts` view, and the new `logbook_ack_at` column.

```bash
supabase db dump --db-url "$OLD_DB_URL" -f roles.sql  --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql   --data-only --use-copy
```

---

## 3. Restore into the new project

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file roles.sql \
  --file schema.sql \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

`session_replication_role = replica` defers FK/trigger checks during the data load
(important because `patient_details.id` / `patient_medications.user_id` reference
`auth.users`).

---

## 4. Re-deploy the Edge Function

The `generate-doctor-summary` function lives in the old project and must be deployed
to the new one:

```bash
supabase link --project-ref <new-ref>
supabase functions deploy generate-doctor-summary
# Re-set any function secrets it relies on:
# supabase secrets set KEY=value --project-ref <new-ref>
```

(If you don't have the function source locally, pull it first:
`supabase functions download generate-doctor-summary --project-ref lbdjjadraskhbqlcpgtt`.)

---

## 5. Storage

`medication_images` is currently empty, so just recreate the bucket in the new
project (Storage → New bucket → `medication_images`, **private**) with the same RLS.
If it ever holds objects, copy them with `rclone` or the Storage API before cutover.

---

## 6. Cut the app over (env vars)

Update **both** local and Vercel to the new project's values, then redeploy:

- `.env.local` and **Vercel → Settings → Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://<new-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → new service-role key
- Redeploy on Vercel (push or "Redeploy").

---

## 7. Verify before decommissioning

- Log in as an existing user (passwords carry over via the `auth` dump) → data is present.
- `total_medications` returns 415 rows; Search + medication detail work.
- A second user **cannot** see another user's meds (RLS intact).
- Add/edit a medication; the logbook acknowledgment respects `logbook_ack_at`.
- Doctor Summary PDF downloads (Edge Function reachable on the new project).
- Confirm in Settings → Database that the region is **ap-southeast-2**.

Only after full verification, pause/delete the old US project.

---

## Notes / gotchas

- Run the dump during low traffic; the app is briefly read-mostly during cutover.
- `pg_dump` major version must be ≥ the Postgres server version, or the dump errors.
- If `roles.sql` complains about the `supabase_admin`/reserved roles already existing,
  that's expected — `ON_ERROR_STOP` plus the documented flow handles it; consult the
  official guide if a role conflict blocks the restore.
- Keep the old project read-only (don't delete) until you've confirmed everything.
