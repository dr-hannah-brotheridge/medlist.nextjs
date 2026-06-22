import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TotalMedication } from "@/lib/types";
import { ChevronLeftIcon, PlusIcon, AlertIcon } from "@/components/icons";

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

  // LAYER 4: Runtime safety — local string fallbacks so the detail view never
  // throws or collapses layout when background LLM enrichment is unconfigured.
  // Every nullable text field resolves to a friendly placeholder instead of
  // vanishing from the DOM.
  const genericNameText = med.medication_name || "Unknown Medication";
  const brandsText = med.brands || "Brand information coming soon.";
  const drugClassText = med.drug_class || null; // chip only shown when present
  const whatItIsUsedForText =
    med.why_it_is_prescribed || "Information details coming soon.";
  const bodyMechanismText =
    med.what_it_does_in_the_body || "Information details coming soon.";
  const whatItProtectsText =
    med.what_organ_or_condition_it_protects ||
    "Information details coming soon.";
  const ifYouStopText =
    med.what_happens_if_you_stop_it || "Information details coming soon.";
  const doseRangeText = med.common_dose_range || "Information details coming soon.";
  const sideEffectsText = med.side_effects || "Information details coming soon.";
  const symptomsToWatchText =
    med.what_symptoms_to_watch_for || "Information details coming soon.";
  const whenToSeekHelpText =
    med.when_to_seek_help || "Information details coming soon.";

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
          {genericNameText}
        </h1>
        <p className="mt-0.5 text-base text-slate-500">{brandsText}</p>
        {drugClassText ? (
          <span className="mt-2 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {drugClassText}
          </span>
        ) : null}
      </header>

      <div className="space-y-3">
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">Why it's prescribed</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {whatItIsUsedForText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">What it does in your body</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {bodyMechanismText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">What it protects</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {whatItProtectsText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">Common dose range</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {doseRangeText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">Common side effects</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {sideEffectsText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">Symptoms to watch for</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {symptomsToWatchText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">If you stop taking it</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {ifYouStopText}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-700">When to seek help</h2>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {whenToSeekHelpText}
          </p>
        </section>
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
