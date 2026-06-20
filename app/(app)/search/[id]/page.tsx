import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TotalMedication } from "@/lib/types";
import { ChevronLeftIcon, PlusIcon, AlertIcon } from "@/components/icons";

const SECTIONS: { key: keyof TotalMedication; label: string }[] = [
  { key: "why_it_is_prescribed", label: "Why it's prescribed" },
  { key: "what_it_does_in_the_body", label: "What it does in your body" },
  {
    key: "what_organ_or_condition_it_protects",
    label: "What it protects",
  },
  { key: "common_dose_range", label: "Common dose range" },
  { key: "side_effects", label: "Common side effects" },
  { key: "what_symptoms_to_watch_for", label: "Symptoms to watch for" },
  { key: "what_happens_if_you_stop_it", label: "If you stop taking it" },
  { key: "when_to_seek_help", label: "When to seek help" },
];

export default async function MedicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const medId = Number(id);
  if (!Number.isFinite(medId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("total_medications")
    .select("*")
    .eq("id", medId)
    .maybeSingle();

  if (!data) notFound();
  const med = data as TotalMedication;

  return (
    <div>
      <Link
        href="/search"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ChevronLeftIcon width={18} height={18} />
        Back to search
      </Link>

      {/* Header: generic name with brand name(s) beneath */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {med.medication_name}
        </h1>
        {med.brands ? (
          <p className="mt-0.5 text-base text-slate-500">{med.brands}</p>
        ) : null}
        {med.drug_class ? (
          <span className="mt-2 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {med.drug_class}
          </span>
        ) : null}
      </header>

      <div className="space-y-3">
        {SECTIONS.map(({ key, label }) => {
          const value = med[key];
          if (!value) return null;
          return (
            <section
              key={key}
              className="rounded-xl border border-slate-200 bg-card p-4"
            >
              <h2 className="text-sm font-semibold text-brand-700">{label}</h2>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {value}
              </p>
            </section>
          );
        })}
      </div>

      <Link
        href={`/my-meds/new?medication_id=${med.id}`}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
      >
        <PlusIcon width={20} height={20} />
        Add to My Meds
      </Link>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
        <span>
          This is general educational information and may not apply to your
          situation. Always consult your doctor or pharmacist before making any
          changes to your medications.
        </span>
      </p>
    </div>
  );
}
