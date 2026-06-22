import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { SearchList } from "@/components/SearchList";
import type { MedicationListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("total_medications")
    .select("id, medication_name, brands")
    .order("medication_name", { ascending: true }).limit(10000);

  if (error) {
    return (
      <div>
        <PageTitle title="Search Medications" />
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load medications. Please try again.
        </p>
      </div>
    );
  }

  const rows = (data ?? []) as MedicationListItem[];

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
