"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncOnboardingDraft } from "@/lib/onboarding";
import {
  AuthShell,
  fieldClass,
  labelClass,
  primaryButtonClass,
} from "@/components/AuthShell";
import {
  VisibilityIcon,
  VisibilityOffIcon,
  MailIcon,
  SpinnerIcon,
} from "@/components/icons";

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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [magicSent, setMagicSent] = useState(false);
  const [magicMode, setMagicMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // "Remember Me OFF" → sign out when the tab/browser closes.
  useEffect(() => {
    if (remember) return;
    function onBeforeUnload() {
      // Best-effort sign-out so the session ends when the browser closes.
      const supabase = createClient();
      supabase.auth.signOut();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [remember]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Sync any pre-auth onboarding draft to the user's profile row.
    if (data.user) {
      await syncOnboardingDraft(data.user.id);
    }
    const dest = searchParams.get("redirectedFrom") || "/home";
    router.push(dest);
    router.refresh();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const redirectUrl = `${window.location.origin}/auth/callback?next=/home`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicSent(true);
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to ScriptPal NZ.">
      {magicSent ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
            If an account exists for {email.trim()}, a sign-in link is on its
            way. Tap the link in your inbox to sign in.
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicSent(false);
              setMagicMode(false);
            }}
            className="font-semibold text-brand-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={magicMode ? sendMagicLink : onSubmit} className="space-y-4">
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

          {magicMode ? null : (
            <div>
              <label className={labelClass} htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass + " pr-12"}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  {showPassword ? (
                    <VisibilityOffIcon width={20} height={20} />
                  ) : (
                    <VisibilityIcon width={20} height={20} />
                  )}
                </button>
              </div>
            </div>
          )}

          {magicMode ? null : (
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 accent-brand-600"
              />
              <span className="font-medium text-slate-800">Remember me</span>
            </label>
          )}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading
              ? magicMode
                ? "Sending…"
                : "Signing in…"
              : magicMode
                ? "Send sign-in link"
                : "Sign in"}
            {loading ? (
              <SpinnerIcon width={18} height={18} className="ml-2 inline" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setMagicMode((v) => !v);
              setError(null);
            }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <MailIcon width={18} height={18} />
            {magicMode ? "Use password instead" : "Sign in with email link"}
          </button>
        </form>
      )}

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/reset-password" className="font-semibold text-brand-600 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}