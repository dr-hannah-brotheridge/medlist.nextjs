"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncOnboardingDraft } from "@/lib/onboarding";
import {
  AuthShell,
  fieldClass,
  labelClass,
  primaryButtonClass,
} from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/home`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Sync the pre-auth onboarding draft (if any) to the new profile row.
    if (data.user) {
      await syncOnboardingDraft(data.user.id);
      router.push("/home");
      router.refresh();
    } else {
      // Email confirmation required — keep the draft so it syncs on first login.
      setNotice(
        "Account created. Please check your email to confirm your address, then sign in.",
      );
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start tracking your medications.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {notice}
          </p>
        ) : null}
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}