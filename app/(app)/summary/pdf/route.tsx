import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DoctorSummaryPdf } from "@/lib/pdf/DoctorSummaryPdf";
import { renderToBuffer } from "@react-pdf/renderer";
import type {
  PatientDetails,
  PatientMedicationWithRef,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generates the patient's Medical Summary as a PDF, streamed from the
 * Next.js app. Authentication comes from the request cookies (same session
 * as the rest of the app), so RLS runs as the logged-in user — identical to
 * the /summary page.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: detailsData }, { data: medsData }] = await Promise.all([
    supabase.from("patient_details").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("patient_medications")
      .select("*, total_medications(medication_name, brands)")
      .order("created_at", { ascending: false }),
  ]);

  const details = (detailsData ?? null) as PatientDetails | null;
  const meds = (medsData ?? []) as PatientMedicationWithRef[];

  const buffer = await renderToBuffer(
    <DoctorSummaryPdf
      details={details}
      medications={meds}
      generatedAt={new Date()}
    />,
  );

  // Copy into a standalone ArrayBuffer so it satisfies NextResponse's BodyInit.
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="medlist-doctor-summary.pdf"',
      "Cache-Control": "no-store",
    },
  });
}