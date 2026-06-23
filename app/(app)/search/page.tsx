import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { SearchList } from "@/components/SearchList";
import type { MedicationListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Supabase PostgREST caps results at 1000 rows server-side by default,
// regardless of .limit(). This paginated fetch bypasses that cap by
// looping in chunks until all rows are retrieved.
const PAGE_SIZE = 1000;

/**
 * Fetch medications with optional server-side ILIKE filtering.
 *
 * When `q` is provided, filters at the database level using substring matching
 * (ILIKE '%q%') across BOTH `medication_name` and `brands` simultaneously.
 * This catches brand names tucked inside parentheses (e.g. typing "Humal"
 * matches "Insulin lispro (Humalog)") and brand names stored in the comma-
 * separated `brands` column (e.g. "Oxyn" matches the Oxycodone row whose
 * brands field contains "Oxynorm").
 *
 * When `q` is empty, returns all rows (for client-side filtering).
 */
async function fetchMedications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  q?: string,
): Promise<MedicationListItem[]> {
  const query = q?.trim();
  const select = "id, medication_name, brands";

  // No server-side query → fetch everything for client-side filtering.
  if (!query) {
    const all: MedicationListItem[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("total_medications")
        .select(select)
        .order("medication_name", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as MedicationListItem[];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return all;
  }

  // Server-side ILIKE filter: '%query%' on medication_name OR brands.
  // PostgREST .or() + .ilike() produces: WHERE medication_name ILIKE '%q%' OR brands ILIKE '%q%'
  const pattern = `%${query}%`;
  const orFilter = `medication_name.ilike.${pattern},brands.ilike.${pattern}`;

  const all: MedicationListItem[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("total_medications")
      .select(select)
      .or(orFilter)
      .order("medication_name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as MedicationListItem[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const query = params.q ?? "";

  let rows: MedicationListItem[] = [];
  let loadError = false;

  try {
    rows = await fetchMedications(supabase, query);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <PageTitle title="Search Medications" />
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load medications. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Search Medications"
        subtitle="Educational information — always confirm with your clinician or pharmacist."
      />
      <SearchList rows={rows} initialQuery={query} />
    </div>
  );
}