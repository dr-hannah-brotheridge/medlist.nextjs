"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  DosageDraft,
  DosageForm,
  DosageUnit,
  MedicationFormValues,
} from "@/lib/types";
import { fieldClass, labelClass } from "@/components/AuthShell";
import { SpinnerIcon, AlertIcon, BookOpenIcon } from "@/components/icons";
import { LogbookAckGate } from "@/components/LogbookAckGate";
import {
  parseBrands,
  formatBrandPreviewWithSelected,
} from "@/lib/medicationHelpers";

interface Props {
  mode: "create" | "edit";
  userId: string;
  medicationId: number;
  medicationName: string;
  brands?: string | null;
  selectedBrand?: string | null;
  recordId?: number;
  initial: MedicationFormValues;
  logbookAccepted: boolean;
  /** Optional slot rendered between the educational CTA and the dosage
   *  fieldset (e.g. the MedicationPhotos uploader on the edit page). */
  photosSlot?: React.ReactNode;
}

const UNITS: DosageUnit[] = ["mg", "mcg", "g", "mL", "Units"];
const FORMS: DosageForm[] = [
  "Tablet",
  "Capsule",
  "Puff",
  "Ointment/Topical Application",
  "Suppository",
  "Wafer",
  "Liquid",
  "Injection",
];
const QUANTITIES = ["0.5", "1", "1.5", "2", "3"];
const FREQUENCIES = [
  "Once daily",
  "12 hourly",
  "8 hourly",
  "6 hourly",
  "Four hourly",
  "Once weekly",
  "Three monthly",
  "As required (PRN)",
  "Specific Days of the Week",
  "Custom option",
] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const EMPTY_DOSAGE: DosageDraft = {
  strength: "",
  unit: "",
  quantity: "",
  form: "",
};

/** Pluralise a form name for the "Take N <form>s" composition. */
function pluralise(form: DosageForm, qty: string): string {
  if (form === "Puff") return qty === "1" ? "1 Puff" : `${qty} Puffs`;
  if (form === "Injection") return qty === "1" ? "1 Injection" : `${qty} Injections`;
  if (form === "Suppository")
    return qty === "1" ? "1 Suppository" : `${qty} Suppositories`;
  return `${qty} ${form}s`;
}

/** Compose structured dosage into a single display/store string. */
function composeDosage(d: DosageDraft): string {
  if (!d.strength || !d.unit || !d.quantity || !d.form) return "";
  return `${d.strength}${d.unit} ${d.form} - Take ${pluralise(d.form, d.quantity)}`;
}

/** Compose the frequency value from the selector (+ days / custom). */
function composeFrequency(
  selection: string,
  days: Record<string, boolean>,
  custom: string,
): string {
  if (selection === "Specific Days of the Week") {
    const chosen = DAYS.filter((d) => days[d]);
    return chosen.length ? chosen.join(", ") : "";
  }
  if (selection === "Custom option") {
    return custom.trim();
  }
  return selection;
}

/** Best-effort parse of a legacy free-text dosage into the structured draft. */
function parseLegacyDosage(text: string): DosageDraft {
  const draft: DosageDraft = { ...EMPTY_DOSAGE };
  if (!text) return draft;

  // Strength + unit, e.g. "500mg" or "12.5 mcg" or "2.5mL"
  const strengthMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|mL|Units)/i);
  if (strengthMatch) {
    draft.strength = strengthMatch[1];
    draft.unit = strengthMatch[2].toLowerCase() as DosageUnit;
  }

  // Form — case-insensitive whole-word match
  for (const f of FORMS) {
    if (new RegExp(`\\b${f}\\b`, "i").test(text)) {
      draft.form = f;
      break;
    }
  }

  // Quantity — "Take 2" or "2 tablets"
  const qtyMatch = text.match(/(?:take\s*)?(\d+(?:\.\d+)?)\s*(?:tablets?|capsules?|puffs?|suppositories?|wafers?|applications?|doses?|s)?/i);
  if (qtyMatch) {
    draft.quantity = qtyMatch[1];
  }

  return draft;
}

/** Best-effort parse of a legacy frequency string into selection + days/custom. */
function parseLegacyFrequency(
  text: string,
): { selection: string; days: Record<string, boolean>; custom: string } {
  const days: Record<string, boolean> = {};
  DAYS.forEach((d) => (days[d] = false));

  if (!text) return { selection: "", days, custom: "" };

  // Day-of-week composition: "Mon, Wed, Fri"
  const dayMatches = DAYS.filter((d) =>
    new RegExp(`\\b${d}\\b`, "i").test(text),
  );
  if (dayMatches.length) {
    dayMatches.forEach((d) => (days[d] = true));
    return { selection: "Specific Days of the Week", days, custom: "" };
  }

  // Exact preset match
  const preset = FREQUENCIES.find((f) => f.toLowerCase() === text.toLowerCase());
  if (preset) return { selection: preset, days, custom: "" };

  // Anything else → custom
  return { selection: "Custom option", days, custom: text };
}

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200";

export function MedicationForm({
  mode,
  userId,
  medicationId,
  medicationName,
  brands,
  selectedBrand,
  recordId,
  initial,
  logbookAccepted,
  photosSlot,
}: Props) {
  const router = useRouter();

  // Structured dosage state (parsed from legacy text in edit mode).
  const [dosage, setDosage] = useState<DosageDraft>(() =>
    parseLegacyDosage(initial.dosage),
  );

  // Frequency selector + conditional inputs.
  const parsedFreq = useMemo(
    () => parseLegacyFrequency(initial.frequency),
    [initial.frequency],
  );
  const [freqSelection, setFreqSelection] = useState(parsedFreq.selection);
  const [freqDays, setFreqDays] = useState<Record<string, boolean>>(
    parsedFreq.days,
  );
  const [freqCustom, setFreqCustom] = useState(parsedFreq.custom);

  const [instructions, setInstructions] = useState(initial.instructions);
  const [startDate, setStartDate] = useState(initial.start_date);
  const [endDate, setEndDate] = useState(initial.end_date);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Tripwire: high single-dose strength ---
  const strengthNum = parseFloat(dosage.strength);
  const showHighDoseWarning =
    !isNaN(strengthNum) &&
    ((dosage.unit === "mg" && strengthNum > 2000) ||
      (dosage.unit === "g" && strengthNum > 4));

  // --- Save gate: strength + unit + form + frequency ---
  const composedFrequency = composeFrequency(freqSelection, freqDays, freqCustom);
  const isValid =
    !!medicationName &&
    dosage.strength !== "" &&
    !isNaN(strengthNum) &&
    strengthNum > 0 &&
    dosage.unit !== "" &&
    dosage.form !== "" &&
    dosage.quantity !== "" &&
    composedFrequency !== "";

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const payload = {
      dosage: composeDosage(dosage),
      frequency: composedFrequency,
      instructions: instructions.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      selected_brand: selectedBrand || null,
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
        {/* Read-only drug name block */}
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          aria-readonly="true"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            🔒 From Search — not editable
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            {medicationName}
          </h2>
          {brands ? (
            <p className="truncate text-sm text-slate-500">
              {formatBrandPreviewWithSelected(
                parseBrands(brands),
                selectedBrand,
                3,
              )}
            </p>
          ) : null}
        </div>

        {/* Premium educational guide CTA */}
        <Link
          href={`/search/${medicationId}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-500 bg-brand-50 px-4 py-3.5 font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          <BookOpenIcon width={20} height={20} />
          View Educational Details
        </Link>

        {/* Optional photos slot (e.g. medication uploader on edit page) */}

        {photosSlot ?? null}

        {/* Structured dosage section */}
        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
          <legend className="px-1 text-sm font-semibold text-brand-700">
            Strength & Quantity
          </legend>

          {/* Part A: Unit strength */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Part A · Unit Strength
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="strength">
                  Strength (number)
                </label>
                <input
                  id="strength"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="e.g. 500"
                  value={dosage.strength}
                  onChange={(e) =>
                    setDosage((d) => ({ ...d, strength: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="unit">
                  Unit
                </label>
                <select
                  id="unit"
                  value={dosage.unit}
                  onChange={(e) =>
                    setDosage((d) => ({
                      ...d,
                      unit: e.target.value as DosageUnit,
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Part B: Quantity + form */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Part B · Quantity & Form
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="quantity">
                  Quantity per dose
                </label>
                <select
                  id="quantity"
                  value={dosage.quantity}
                  onChange={(e) =>
                    setDosage((d) => ({ ...d, quantity: e.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {QUANTITIES.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="form">
                  Form / Administration
                </label>
                <select
                  id="form"
                  value={dosage.form}
                  onChange={(e) =>
                    setDosage((d) => ({
                      ...d,
                      form: e.target.value as DosageForm,
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* High-dose tripwire */}
          {showHighDoseWarning ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertIcon
                width={18}
                height={18}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <p className="text-sm leading-relaxed text-amber-700">
                ⚠️ Please double-check your medication packaging. It is rare to
                take a single dose this high. Did you accidentally type an extra
                zero or enter your total daily dose instead of a single dose?
              </p>
            </div>
          ) : null}

          {/* Live preview of composed dosage */}
          {dosage.strength && dosage.unit && dosage.quantity && dosage.form ? (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Preview:{" "}
              <span className="font-semibold">{composeDosage(dosage)}</span>
            </p>
          ) : null}
        </fieldset>

        {/* Frequency section */}
        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
          <legend className="px-1 text-sm font-semibold text-brand-700">
            Frequency
          </legend>
          <div>
            <label className={labelClass} htmlFor="frequency">
              Schedule
            </label>
            <select
              id="frequency"
              value={freqSelection}
              onChange={(e) => setFreqSelection(e.target.value)}
              className={selectClass}
            >
              <option value="">Select…</option>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional: specific days of the week */}
          {freqSelection === "Specific Days of the Week" ? (
            <div>
              <p className={labelClass}>On which days?</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map((d) => (
                  <label
                    key={d}
                    className={
                      "flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium transition " +
                      (freqDays[d]
                        ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={!!freqDays[d]}
                      onChange={(e) =>
                        setFreqDays((prev) => ({ ...prev, [d]: e.target.checked }))
                      }
                      className="sr-only"
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {/* Conditional: custom text */}
          {freqSelection === "Custom option" ? (
            <div>
              <label className={labelClass} htmlFor="custom-freq">
                Custom instructions
              </label>
              <input
                id="custom-freq"
                type="text"
                placeholder="e.g. Every second Tuesday before breakfast"
                value={freqCustom}
                onChange={(e) => setFreqCustom(e.target.value)}
                className={fieldClass}
              />
            </div>
          ) : null}

          {/* Live preview of composed frequency */}
          {composedFrequency ? (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Preview:{" "}
              <span className="font-semibold">{composedFrequency}</span>
            </p>
          ) : null}
        </fieldset>

        {/* Instructions + schedule */}
        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
          <legend className="px-1 text-sm font-semibold text-brand-700">
            Notes & Schedule
          </legend>
          <div>
            <label className={labelClass} htmlFor="instructions">
              Instructions
            </label>
            <input
              id="instructions"
              placeholder="e.g. Take with food"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="start_date">
                Start Date
              </label>
              <input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
          disabled={saving || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <SpinnerIcon width={18} height={18} /> : null}
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Add medication"
              : "Save Changes"}
        </button>

        {!isValid ? (
          <p className="text-center text-xs text-slate-400">
            Enter a strength, unit, form, and frequency to enable saving.
          </p>
        ) : null}

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