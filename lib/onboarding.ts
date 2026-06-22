/**
 * Pre-auth onboarding draft, stored in localStorage until the user signs in,
 * then synced to `patient_details` with `onboarded_at` set.
 */
export const ONBOARDING_STORAGE_KEY = "medlist:onboarding";

export type OnboardingDraft = {
  role: "myself" | "caregiver" | null;
  fullName: string;
  nhi: string;
  allergies: string;
};

export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(draft));
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

/**
 * Push the pre-auth onboarding draft into the user's `patient_details` row,
 * stamp `onboarded_at`, and clear the draft. Safe no-op if no draft exists.
 * Must run in a client component after a session has been established.
 */
export async function syncOnboardingDraft(userId: string) {
  const draft = readOnboardingDraft();
  if (!draft) return;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  const [first, ...rest] = draft.fullName.trim().split(/\s+/);
  const last = rest.join(" ");

  await supabase.from("patient_details").upsert(
    {
      id: userId,
      first_name: first || null,
      last_name: last || null,
      nhi_number: draft.nhi.trim() || null,
      allergies: draft.allergies.trim() || null,
      caregiver_role: draft.role,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  clearOnboardingDraft();
}