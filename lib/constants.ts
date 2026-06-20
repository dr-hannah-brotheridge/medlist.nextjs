/** Server-only: emails allowed to access /admin. */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/** Columns of total_medications the admin grid can view/edit (excludes id). */
export const REFERENCE_FIELDS = [
  "medication_name",
  "brands",
  "drug_class",
  "why_it_is_prescribed",
  "what_it_does_in_the_body",
  "what_organ_or_condition_it_protects",
  "what_happens_if_you_stop_it",
  "common_dose_range",
  "side_effects",
  "what_symptoms_to_watch_for",
  "when_to_seek_help",
] as const;

export type ReferenceField = (typeof REFERENCE_FIELDS)[number];

export const REFERENCE_FIELD_LABELS: Record<ReferenceField, string> = {
  medication_name: "Medication name",
  brands: "Brands",
  drug_class: "Drug class",
  why_it_is_prescribed: "Why it's prescribed",
  what_it_does_in_the_body: "What it does in your body",
  what_organ_or_condition_it_protects: "What it protects",
  what_happens_if_you_stop_it: "If you stop it",
  common_dose_range: "Common dose range",
  side_effects: "Common side effects",
  what_symptoms_to_watch_for: "Symptoms to watch for",
  when_to_seek_help: "When to seek help",
};
