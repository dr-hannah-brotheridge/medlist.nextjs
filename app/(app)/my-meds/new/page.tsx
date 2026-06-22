import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { MedicationForm } from "@/components/forms/MedicationForm";
import { ChevronLeftIcon } from "@/components/icons";
import type { MedicationFormValues } from "@/lib/types";

const EMPTY: MedicationFormValues = {
  dosage: "",
  frequency: "",
  instructions: "",
  start_date: "",
  end_date: "",
};

export default async function NewMedicationPage({
  searchParams,
}: {
  searchParams: Promise<{ medication_id?: string; selected_brand?: string }>;
}) {
  const { medication_id, selected_brand } = await searchParams;
  const medId = Number(medication_id);
  if (!medication_id || !Number.isFinite(medId)) {
    // No medication chosen — send the user to pick one.
    redirect("/search");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: med } = await supabase
    .from("total_medications")
    .select("id, medication_name, brands")
    .eq("id", medId)
    .maybeSingle();

  if (!med) notFound();

  const { data: pd } = await supabase
    .from("patient_details")
    .select("logbook_ack_at")
    .eq("id", user.id)
    .maybeSingle();
  const logbookAccepted = Boolean(pd?.logbook_ack_at);

  return (
    <div>
      <Link
        href="/search"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ChevronLeftIcon width={18} height={18} />
        Back
      </Link>
      <PageTitle title="Add Medication" />
      <MedicationForm
        mode="create"
        userId={user.id}
        medicationId={med.id}
        medicationName={med.medication_name}
        brands={med.brands}
        selectedBrand={selected_brand}
        initial={EMPTY}
        logbookAccepted={logbookAccepted}
      />
    </div>
  );
}
