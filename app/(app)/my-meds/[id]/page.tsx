import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { MedicationForm } from "@/components/forms/MedicationForm";
import { MedicationPhotos } from "@/components/MedicationPhotos";
import { ChevronLeftIcon } from "@/components/icons";
import { toISODate } from "@/lib/date";
import type {
  PatientMedicationWithRef,
  MedicationPhotoWithUrl,
} from "@/lib/types";

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

  const { data: pd } = await supabase
    .from("patient_details")
    .select("logbook_ack_at")
    .eq("id", user.id)
    .maybeSingle();
  const logbookAccepted = Boolean(pd?.logbook_ack_at);

  // Fetch existing photos + signed URLs for display.
  const { data: photoRows } = await supabase
    .from("medication_photos")
    .select("*")
    .eq("patient_medication_id", med.id)
    .order("position", { ascending: true });

  const photos: MedicationPhotoWithUrl[] = [];
  for (const row of photoRows ?? []) {
    const r = row as Omit<MedicationPhotoWithUrl, "url">;
    const { data: signed } = await supabase.storage
      .from("medication-photos")
      .createSignedUrl(r.storage_path, 3600);
    photos.push({ ...r, url: signed?.signedUrl ?? "" });
  }

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
        selectedBrand={med.selected_brand}
        recordId={med.id}
        initial={{
          dosage: med.dosage ?? "",
          frequency: med.frequency ?? "",
          instructions: med.instructions ?? "",
          start_date: toISODate(med.start_date),
          end_date: toISODate(med.end_date),
        }}
        logbookAccepted={logbookAccepted}
        photosSlot={
          <MedicationPhotos
            userId={user.id}
            patientMedicationId={med.id}
            initial={photos}
          />
        }
      />
    </div>
  );
}