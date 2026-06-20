import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { MedicationForm } from "@/components/forms/MedicationForm";
import { ChevronLeftIcon } from "@/components/icons";
import { toISODate } from "@/lib/date";
import type { PatientMedicationWithRef } from "@/lib/types";

export default async function EditMedicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recordId = Number(id);
  if (!Number.isFinite(recordId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("patient_medications")
    .select("*, total_medications(medication_name, brands)")
    .eq("id", recordId)
    .maybeSingle();

  if (!data) notFound();
  const med = data as PatientMedicationWithRef;

  return (
    <div>
      <Link
        href="/my-meds"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ChevronLeftIcon width={18} height={18} />
        Back to My Meds
      </Link>
      <PageTitle title="Medication Details" />
      <MedicationForm
        mode="edit"
        userId={user.id}
        medicationId={med.medication_id}
        medicationName={med.total_medications?.medication_name ?? "Medication"}
        brands={med.total_medications?.brands}
        recordId={med.id}
        initial={{
          dosage: med.dosage ?? "",
          frequency: med.frequency ?? "",
          instructions: med.instructions ?? "",
          start_date: toISODate(med.start_date),
          end_date: toISODate(med.end_date),
        }}
      />
    </div>
  );
}
