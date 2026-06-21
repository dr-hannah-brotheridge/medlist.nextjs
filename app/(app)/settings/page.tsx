import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { toISODate } from "@/lib/date";
import type { PatientDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only honour internal paths to avoid open-redirects.
  const redirectTo = next && next.startsWith("/") ? next : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("patient_details")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const d = (data ?? null) as PatientDetails | null;

  return (
    <div>
      <PageTitle
        title="My Settings"
        subtitle="This information appears on your Doctor Summary."
      />
      <ProfileForm
        userId={user.id}
        redirectTo={redirectTo}
        initial={{
          first_name: d?.first_name ?? "",
          last_name: d?.last_name ?? "",
          date_of_birth: toISODate(d?.date_of_birth),
          nhi_number: d?.nhi_number ?? "",
          emergency_contact_name: d?.emergency_contact_name ?? "",
          emergency_contact_phone: d?.emergency_contact_phone ?? "",
          primary_gp: d?.primary_gp ?? "",
          allergies: d?.allergies ?? "",
          pharmacy_name: d?.pharmacy_name ?? "",
          pharmacy_phone: d?.pharmacy_phone ?? "",
        }}
      />
    </div>
  );
}
