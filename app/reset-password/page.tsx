"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AuthShell,
  fieldClass,
  labelClass,
  primaryButtonClass,
} from "@/components/AuthShell";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll email you a link to set a new password."
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            If an account exists for {email}, a reset link is on its way.
          </p>
          <Link
            href="/login"
            className="block text-center text-sm text-brand-600 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
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
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClass}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link
            href="/login"
            className="block text-center text-sm text-brand-600 hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
