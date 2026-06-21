// Types mirror the confirmed live Supabase schema (project ref lbdjjadraskhbqlcpgtt).

/** Reference medication database — READ ONLY from the consumer app (415 rows). */
export interface TotalMedication {
  id: number;
  medication_name: string;
  drug_class: string | null;
  why_it_is_prescribed: string | null;
  what_it_does_in_the_body: string | null;
  what_organ_or_condition_it_protects: string | null;
  what_happens_if_you_stop_it: string | null;
  common_dose_range: string | null;
  side_effects: string | null;
  what_symptoms_to_watch_for: string | null;
  when_to_seek_help: string | null;
  brands: string | null;
}

/** Lightweight row used by the search list (one fetch of all rows). */
export interface MedicationListItem {
  id: number;
  medication_name: string;
  brands: string | null;
}

/** Per-user profile. `id` IS the auth user id (1:1, FK to auth.users). */
export interface PatientDetails {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null; // ISO date (YYYY-MM-DD)
  nhi_number: string | null;
  allergies: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  primary_gp: string | null;
  pharmacy_name: string | null;
  pharmacy_phone: string | null;
  logbook_ack_at: string | null; // ISO timestamp of logbook acknowledgment
  updated_at: string | null;
}

/** A medication the user takes. Identity comes from medication_id -> total_medications. */
export interface PatientMedication {
  id: number;
  user_id: string;
  medication_id: number;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null; // ISO date
  end_date: string | null; // ISO date
  instructions: string | null;
  created_at: string;
}

/** patient_medications joined to its reference medication (for display). */
export interface PatientMedicationWithRef extends PatientMedication {
  total_medications: Pick<
    TotalMedication,
    "medication_name" | "brands"
  > | null;
}

/** Editable patient-owned fields on the medication form. */
export interface MedicationFormValues {
  dosage: string;
  frequency: string;
  instructions: string;
  start_date: string;
  end_date: string;
}

/** Editable fields on the profile / settings form. */
export interface ProfileFormValues {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nhi_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  primary_gp: string;
  allergies: string;
  pharmacy_name: string;
  pharmacy_phone: string;
}
