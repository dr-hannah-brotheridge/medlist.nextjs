import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First-time gate: send users who haven't completed onboarding to the
  // 4-step wizard. Once `onboarded_at` is set, they proceed to the app.
  const { data } = await supabase
    .from("patient_details")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.onboarded_at) {
    redirect("/onboarding");
  }

  return <AppChrome>{children}</AppChrome>;
}