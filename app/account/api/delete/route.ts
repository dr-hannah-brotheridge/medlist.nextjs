import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes the *calling* user's account and their data. The user can only ever
 * delete themselves (id is taken from the verified session, never the body).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Account deletion is not configured." },
      { status: 501 },
    );
  }

  // Remove the user's data first (in case FK cascade isn't configured).
  await admin.from("patient_medications").delete().eq("user_id", user.id);
  await admin.from("patient_details").delete().eq("id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
