import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Returning users skip onboarding and go straight to the app.
  if (user) {
    redirect("/home");
  }

  // New visitors land on the 4-step onboarding wizard.
  return <OnboardingFlow />;
}