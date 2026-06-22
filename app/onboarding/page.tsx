import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("patient_details")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.onboarded_at) redirect("/home");

  return <OnboardingFlow userId={user.id} />;
}