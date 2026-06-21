"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertIcon, SpinnerIcon } from "@/components/icons";

const ACK_COPY =
  "I understand MedList acts strictly as a digital logbook. It is entirely dependent on my ability to read and manually transcribe the accurate text from my physical pharmacy prescription label. MedList does not auto-verify, sync, or fix my personal inputs.";

/**
 * One-time, unskippable acknowledgment shown the first time a user opens the
 * Medication Details form. Acceptance is persisted per-account in
 * `patient_details.logbook_ack_at` (durable across devices). `initialAccepted`
 * is provided by the server page so there is no flash or extra round trip.
 */
export function LogbookAckGate({
  userId,
  initialAccepted,
  children,
}: {
  userId: string;
  initialAccepted: boolean;
  children: React.ReactNode;
}) {
  const [acked, setAcked] = useState(initialAccepted);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    // Upsert so it works whether or not a patient_details row exists yet.
    const { error } = await supabase
      .from("patient_details")
      .upsert(
        { id: userId, logbook_ack_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    setSaving(false);
    if (error) {
      setError("Could not save your acknowledgment. Please try again.");
      return;
    }
    setAcked(true);
  }

  const showModal = !acked;

  return (
    <>
      {/* Render the form so it's ready, but block interaction until accepted. */}
      <div
        aria-hidden={showModal}
        className={showModal ? "pointer-events-none select-none blur-sm" : ""}
      >
        {children}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ack-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-card p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <AlertIcon width={22} height={22} />
              <h2
                id="ack-title"
                className="text-base font-semibold text-slate-900"
              >
                Before you add a medication
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{ACK_COPY}</p>

            <label className="mt-4 flex items-start gap-3 rounded-lg bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
              />
              <span className="text-sm text-slate-700">
                I have read and understand the above.
              </span>
            </label>

            {error ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!checked || saving}
              onClick={accept}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <SpinnerIcon width={18} height={18} /> : null}
              {saving ? "Saving…" : "I understand — continue"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
