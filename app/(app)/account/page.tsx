import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/AppChrome";
import { AccountActions } from "@/components/AccountActions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <PageTitle title="Account Settings" subtitle={user.email ?? undefined} />
      <AccountActions email={user.email ?? ""} />
    </div>
  );
}
