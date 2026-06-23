import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { formatNZDate } from "@/lib/date";
import type { PatientMedicationWithRef } from "@/lib/types";
import {
  ChevronRightIcon,
  PlusIcon,
  PillIcon,
} from "@/components/icons";
import {
  parseBrands,
  formatBrandPreviewWithSelected,
} from "@/lib/medicationHelpers";

export const dynamic = "force-dynamic";

export default async function MyMedsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_medications")
    .select("*, total_medications(medication_name, brands)")
    .order("created_at", { ascending: false });

  const meds = (data ?? []) as PatientMedicationWithRef[];

  return (
    <div>
      <PageTitle
        title="My Meds"
        subtitle="The medications you're currently tracking."
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load your medications. Please try again.
        </p>
      ) : meds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-card p-8 text-center">
          <PillIcon
            width={32}
            height={32}
            className="mx-auto text-slate-300"
          />
          <p className="mt-3 font-medium text-slate-700">No medications yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Find a medication in Search and add it here.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700"
          >
            <PlusIcon width={18} height={18} />
            Add a medication
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {meds.map((m) => {
            const name = m.total_medications?.medication_name ?? "Medication";
            const dose = [m.dosage, m.frequency].filter(Boolean).join(" · ");
            return (
              <li key={m.id}>
                <Link
                  href={`/my-meds/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      {name}
                    </span>
                    {m.total_medications?.brands ? (
                      <span className="block truncate text-sm text-slate-500">
                        {formatBrandPreviewWithSelected(
                          parseBrands(m.total_medications.brands),
                          m.selected_brand,
                          3,
                        )}
                      </span>
                    ) : null}
                    {dose ? (
                      <span className="block text-sm text-slate-600">
                        {dose}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-slate-400">
                      Since {formatNZDate(m.start_date)}
                      {m.end_date ? ` · Until ${formatNZDate(m.end_date)}` : ""}
                    </span>
                  </span>
                  <ChevronRightIcon
                    width={18}
                    height={18}
                    className="shrink-0 text-slate-300"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {meds.length > 0 ? (
        <Link
          href="/search"
          className="fixed bottom-24 right-1/2 z-30 flex min-h-[52px] translate-x-1/2 items-center gap-2 rounded-full bg-brand-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-brand-700 sm:right-[calc(50%-13rem)] sm:translate-x-0"
        >
          <PlusIcon width={20} height={20} />
          Add more
        </Link>
      ) : null}
    </div>
  );
}
