import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { SearchList } from "@/components/SearchList";
import type { MedicationListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Supabase PostgREST caps results at 1000 rows server-side by default,
// regardless of .limit(). This paginated fetch bypasses that cap by
// looping in chunks until all rows are retrieved.
const PAGE_SIZE = 1000;

async function fetchAllMedications(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<MedicationListItem[]> {
  const all: MedicationListItem[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("total_medications")
      .select("id, medication_name, brands")
      .order("medication_name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data ?? []) as MedicationListItem[];
    all.push(...rows);

    if (rows.length < PAGE_SIZE) break; // last page reached
    offset += PAGE_SIZE;
  }

  return all;
}

export default async function SearchPage() {
  const supabase = await createClient();

  let rows: MedicationListItem[] = [];
  let loadError = false;

  try {
    rows = await fetchAllMedications(supabase);
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
      <SearchList rows={rows} />
    </div>
  );
}