"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AuthShell,
  fieldClass,
  labelClass,
  primaryButtonClass,
} from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <Suspense
      fallback={<AuthShell title="Sign in" subtitle="Loading…">{null}</AuthShell>}
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const dest = searchParams.get("redirectedFrom") || "/home";
    router.push(dest);
    router.refresh();
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to MedList.">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/reset-password" className="text-brand-600 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-brand-600 hover:underline">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
