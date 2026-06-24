"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  fieldClass,
  labelClass,
} from "@/components/AuthShell";
import {
  UserIcon,
  UsersIcon,
  InfoIcon,
  SearchIcon,
  CameraIcon,
  ClipboardIcon,
  ShieldIcon,
  CheckIcon,
  SpinnerIcon,
} from "@/components/icons";
import {
  writeOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding";

type Role = "myself" | "caregiver" | null;

const TOTAL_STEPS = 4;

/**
 * 4-step pre-auth onboarding wizard. Draft answers are written to
 * localStorage and then synced to `patient_details` after the user signs in.
 * Completing the wizard routes the visitor to `/signup`.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "back">("next");

  // Step 2 state
  const [role, setRole] = useState<Role>(null);

  // Step 4 state
  const [fullName, setFullName] = useState("");
  const [nhi, setNhi] = useState("");
  const [allergies, setAllergies] = useState("");
  const [showNhiTooltip, setShowNhiTooltip] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function goNext() {
    setDirection("next");
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }
  function goBack() {
    setDirection("back");
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function onComplete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const draft: OnboardingDraft = {
      role,
      fullName: fullName.trim(),
      nhi: nhi.trim(),
      allergies: allergies.trim(),
    };
    writeOnboardingDraft(draft);

    // Route to signup. If the visitor is somehow already authenticated
    // (e.g. returning user revisiting `/`), middleware will bounce them
    // to /home and the post-auth sync will write the draft to the DB.
    router.push("/signup");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-50 to-surface">
      <header className="px-4 pt-6">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <p className="text-lg font-extrabold tracking-tight text-brand-600">
            ScriptPal NZ
          </p>
          <ProgressDots step={step} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Slide key triggers a fresh transition class per step */}
          <div
            key={step}
            className={
              direction === "next"
                ? "animate-[fadeSlideIn_0.25s_ease-out]"
                : "animate-[fadeSlideBack_0.25s_ease-out]"
            }
          >
            {step === 0 && <StepHook onNext={goNext} />}
            {step === 1 && (
              <StepRole
                role={role}
                onSelect={setRole}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {step === 2 && <StepFeatures onNext={goNext} onBack={goBack} />}
            {step === 3 && (
              <StepProfile
                fullName={fullName}
                nhi={nhi}
                allergies={allergies}
                showNhiTooltip={showNhiTooltip}
                onFullName={setFullName}
                onNhi={setNhi}
                onAllergies={setAllergies}
                onToggleTooltip={() => setShowNhiTooltip((v) => !v)}
                onSubmit={onComplete}
                onBack={goBack}
                saving={saving}
                error={error}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="ml-auto flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={
            "h-2 w-2 rounded-full transition " +
            (i === step
              ? "bg-brand-600"
              : i < step
                ? "bg-brand-400"
                : "bg-brand-200")
          }
        />
      ))}
    </div>
  );
}

function StepHook({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
        <ShieldIcon width={32} height={32} />
      </div>
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
        Demystify your medications.
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-slate-600">
        Ever been baffled by why you're taking a pill or what its brand name
        means? ScriptPal NZ translates complex medical jargon into plain English, so
        you can take control of your health.
      </p>
      <button
        onClick={onNext}
        className="mt-8 w-full rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        Get Started
      </button>
    </div>
  );
}

function StepRole({
  role,
  onSelect,
  onNext,
  onBack,
}: {
  role: Role;
  onSelect: (r: Role) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Who are you managing medications for?
      </h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <RoleCard
          active={role === "myself"}
          onClick={() => onSelect("myself")}
          Icon={UserIcon}
          title="Myself"
          subtitle="I want to track my own scripts, understand my side effects, and keep my doctor informed."
        />
        <RoleCard
          active={role === "caregiver"}
          onClick={() => onSelect("caregiver")}
          Icon={UsersIcon}
          title="A Parent or Loved One"
          subtitle="I am a family member, whānau, or caregiver helping someone else manage their health."
        />
      </div>
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-xl px-4 py-3 text-base font-semibold text-slate-500 transition hover:text-slate-700"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!role}
          className="flex-1 rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  Icon: (p: { width: number; height: number }) => React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-h-[10rem] flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition " +
        (active
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
          : "border-slate-200 bg-card hover:border-brand-300 hover:bg-brand-50/50")
      }
    >
      <span
        className={
          "flex h-12 w-12 items-center justify-center rounded-xl transition " +
          (active ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-600")
        }
      >
        <Icon width={24} height={24} />
      </span>
      <span className="font-semibold text-slate-900">{title}</span>
      <span className="text-sm leading-relaxed text-slate-600">{subtitle}</span>
      {active ? (
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand-700">
          <CheckIcon width={16} height={16} /> Selected
        </span>
      ) : null}
    </button>
  );
}

function StepFeatures({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const items = [
    {
      Icon: SearchIcon,
      title: "Search NZ Meds",
      body: "Look up any funded medicine by brand or generic name using official New Zealand database terms.",
    },
    {
      Icon: CameraIcon,
      title: "Snap & Identify",
      body: "Add your dose, then upload photos of your pill boxes, blister packs, or individual tablets so you never mix up 'the red pill' again.",
    },
    {
      Icon: ClipboardIcon,
      title: "One-Click Summary",
      body: "Instantly generate a clean PDF summary with your NHI, allergies, and full med list to show your GP or hospital team.",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Powerful tools in your pocket.
      </h2>
      <ul className="mt-6 space-y-3">
        {items.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-card p-4 shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon width={22} height={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">{title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-xl px-4 py-3 text-base font-semibold text-slate-500 transition hover:text-slate-700"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StepProfile({
  fullName,
  nhi,
  allergies,
  showNhiTooltip,
  onFullName,
  onNhi,
  onAllergies,
  onToggleTooltip,
  onSubmit,
  onBack,
  saving,
  error,
}: {
  fullName: string;
  nhi: string;
  allergies: string;
  showNhiTooltip: boolean;
  onFullName: (v: string) => void;
  onNhi: (v: string) => void;
  onAllergies: (v: string) => void;
  onToggleTooltip: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Create the safety net.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This information is stored securely on your device and is used to create
        your downloadable medical summary.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelClass} htmlFor="full_name">
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            required
            value={fullName}
            onChange={(e) => onFullName(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label className={labelClass} htmlFor="nhi">
              NHI Number
            </label>
            <button
              type="button"
              onClick={onToggleTooltip}
              aria-label="What is an NHI number?"
              className="text-slate-400 transition hover:text-brand-600"
            >
              <InfoIcon width={16} height={16} />
            </button>
          </div>
          <input
            id="nhi"
            type="text"
            placeholder="e.g. ABC1234"
            value={nhi}
            onChange={(e) => onNhi(e.target.value)}
            className={fieldClass}
          />
          {showNhiTooltip ? (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm leading-relaxed text-brand-800">
              <InfoIcon width={16} height={16} className="mt-0.5 shrink-0" />
              Your National Health Index helps hospital doctors match your list
              instantly.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="allergies">
            Allergies
          </label>
          <textarea
            id="allergies"
            rows={3}
            placeholder="e.g., Penicillin, Peanuts"
            value={allergies}
            onChange={(e) => onAllergies(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-3 text-base font-semibold text-slate-500 transition hover:text-slate-700"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60"
        >
          {saving ? <SpinnerIcon width={20} height={20} /> : null}
          {saving ? "Entering…" : "Enter ScriptPal NZ 🚀"}
        </button>
      </div>
    </form>
  );
}