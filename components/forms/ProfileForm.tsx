"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileFormValues } from "@/lib/types";
import { fieldClass, labelClass } from "@/components/AuthShell";
import { SpinnerIcon, UserIcon, AlertIcon, ShieldIcon } from "@/components/icons";

export function ProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial: ProfileFormValues;
}) {
  const router = useRouter();
  // Local-only state: typing never touches the network.
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof ProfileFormValues>(key: K) {
    return {
      value: values[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSaved(false);
        setValues((v) => ({ ...v, [key]: e.target.value }));
      },
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("patient_details").upsert(
      {
        id: userId,
        first_name: values.first_name.trim() || null,
        last_name: values.last_name.trim() || null,
        date_of_birth: values.date_of_birth || null,
        nhi_number: values.nhi_number.trim() || null,
        emergency_contact_name: values.emergency_contact_name.trim() || null,
        emergency_contact_phone: values.emergency_contact_phone.trim() || null,
        primary_gp: values.primary_gp.trim() || null,
        allergies: values.allergies.trim() || null,
        pharmacy_name: values.pharmacy_name.trim() || null,
        pharmacy_phone: values.pharmacy_phone.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="space-y-5">
      <Section icon={<UserIcon width={18} height={18} />} title="Profile Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" id="first_name" {...field("first_name")} />
          <Field label="Last Name" id="last_name" {...field("last_name")} />
        </div>
        <Field
          label="Date of Birth"
          id="date_of_birth"
          type="date"
          {...field("date_of_birth")}
        />
        <Field label="NHI Number" id="nhi_number" {...field("nhi_number")} />
      </Section>

      <Section
        icon={<AlertIcon width={18} height={18} />}
        title="Emergency Contact"
      >
        <Field
          label="Contact Name"
          id="emergency_contact_name"
          {...field("emergency_contact_name")}
        />
        <Field
          label="Contact Phone"
          id="emergency_contact_phone"
          type="tel"
          {...field("emergency_contact_phone")}
        />
      </Section>

      <Section icon={<ShieldIcon width={18} height={18} />} title="Primary GP">
        <Field
          label="Practice / Clinic"
          id="primary_gp"
          placeholder="Clinic or practice name"
          {...field("primary_gp")}
        />
      </Section>

      <Section icon={<AlertIcon width={18} height={18} />} title="Allergies">
        <div>
          <label className={labelClass} htmlFor="allergies">
            Allergies / Adverse Reactions
          </label>
          <textarea
            id="allergies"
            rows={3}
            placeholder="Name + reaction"
            className={fieldClass}
            {...field("allergies")}
          />
        </div>
      </Section>

      <Section icon={<ShieldIcon width={18} height={18} />} title="Pharmacy Details">
        <Field
          label="Pharmacy Name"
          id="pharmacy_name"
          {...field("pharmacy_name")}
        />
        <Field
          label="Pharmacy Phone"
          id="pharmacy_phone"
          type="tel"
          placeholder="e.g. +64 9 000 0000"
          {...field("pharmacy_phone")}
        />
      </Section>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-24 z-20">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <SpinnerIcon width={18} height={18} /> : null}
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  id,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={fieldClass}
      />
    </div>
  );
}
