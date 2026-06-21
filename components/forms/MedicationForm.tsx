"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MedicationFormValues } from "@/lib/types";
import { fieldClass, labelClass } from "@/components/AuthShell";
import { SpinnerIcon } from "@/components/icons";
import { LogbookAckGate } from "@/components/LogbookAckGate";

interface Props {
  mode: "create" | "edit";
  userId: string;
  medicationId: number;
  medicationName: string;
  brands?: string | null;
  recordId?: number;
  initial: MedicationFormValues;
  logbookAccepted: boolean;
}

const EMPTY: MedicationFormValues = {
  dosage: "",
  frequency: "",
  instructions: "",
  start_date: "",
  end_date: "",
};

export function MedicationForm({
  mode,
  userId,
  medicationId,
  medicationName,
  brands,
  recordId,
  initial,
  logbookAccepted,
}: Props) {
  const router = useRouter();
  // All editing happens in LOCAL state — zero server round-trips per keystroke.
  const [values, setValues] = useState<MedicationFormValues>({
    ...EMPTY,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof MedicationFormValues>(
    key: K,
    value: MedicationFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const payload = {
      dosage: values.dosage.trim() || null,
      frequency: values.frequency.trim() || null,
      instructions: values.instructions.trim() || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    };

    const { error } =
      mode === "create"
        ? await supabase.from("patient_medications").insert({
            user_id: userId,
            medication_id: medicationId,
            ...payload,
          })
        : await supabase
            .from("patient_medications")
            .update(payload)
            .eq("id", recordId!);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.push("/my-meds");
    router.refresh();
  }

  async function onDelete() {
    if (!recordId) return;
    if (!confirm(`Remove ${medicationName} from your medications?`)) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("patient_medications")
      .delete()
      .eq("id", recordId);
    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }
    router.push("/my-meds");
    router.refresh();
  }

  return (
    <LogbookAckGate userId={userId} initialAccepted={logbookAccepted}>
    <form onSubmit={onSave} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-card p-4">
        <h2 className="text-base font-semibold text-slate-900">
          {medicationName}
        </h2>
        {brands ? <p className="text-sm text-slate-500">{brands}</p> : null}
      </div>

      <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
        <legend className="px-1 text-sm font-semibold text-brand-700">
          Medication Info
        </legend>
        <div>
          <label className={labelClass} htmlFor="dosage">
            Dosage
          </label>
          <input
            id="dosage"
            placeholder="e.g. 500mg"
            value={values.dosage}
            onChange={(e) => update("dosage", e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="frequency">
            Frequency
          </label>
          <input
            id="frequency"
            placeholder="e.g. Twice daily"
            value={values.frequency}
            onChange={(e) => update("frequency", e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="instructions">
            Instructions
          </label>
          <input
            id="instructions"
            placeholder="e.g. Take with food"
            value={values.instructions}
            onChange={(e) => update("instructions", e.target.value)}
            className={fieldClass}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
        <legend className="px-1 text-sm font-semibold text-brand-700">
          Schedule
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="start_date">
              Start Date
            </label>
            <input
              id="start_date"
              type="date"
              value={values.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="end_date">
              End Date
            </label>
            <input
              id="end_date"
              type="date"
              value={values.end_date}
              onChange={(e) => update("end_date", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </fieldset>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? <SpinnerIcon width={18} height={18} /> : null}
        {saving ? "Saving…" : mode === "create" ? "Add medication" : "Save Changes"}
      </button>

      {mode === "edit" ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="w-full rounded-lg border border-red-200 px-4 py-2.5 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? "Removing…" : "Remove from My Meds"}
        </button>
      ) : null}
    </form>
    </LogbookAckGate>
  );
}
