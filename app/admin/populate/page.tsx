import { createAdminClient } from "@/lib/supabase/admin";
import { DataGrid } from "@/components/admin/DataGrid";
import { REFERENCE_FIELDS } from "@/lib/constants";
import type { TotalMedication } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PopulatePage() {
  let rows: TotalMedication[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("total_medications")
      .select(["id", ...REFERENCE_FIELDS].join(","))
      .order("medication_name", { ascending: true });
    if (error) throw error;
    rows = (data ?? []) as unknown as TotalMedication[];
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Service role key not configured.";
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">
          Reference Data — Populate
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and enrich the {rows.length} reference medications. Edits sync
          only when a column is blank, or when you explicitly Approve &amp; Sync
          a row. Existing manual text is never overwritten automatically.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Could not load reference data: {loadError}
        </p>
      ) : (
        <DataGrid initialRows={rows} />
      )}
    </div>
  );
}
