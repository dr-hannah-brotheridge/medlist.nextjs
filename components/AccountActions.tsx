"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SpinnerIcon } from "@/components/icons";

export function AccountActions({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "logout" | "delete" | "reset">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    setBusy("logout");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function sendReset() {
    setError(null);
    setMessage(null);
    setBusy("reset");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(null);
    if (error) setError(error.message);
    else setMessage(`A password reset link has been sent to ${email}.`);
  }

  async function deleteAccount() {
    if (
      !confirm(
        "Permanently delete your account and all your data? This cannot be undone.",
      )
    )
      return;
    setError(null);
    setBusy("delete");
    const res = await fetch("/account/api/delete", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete your account.");
      setBusy(null);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-card p-4">
        <button
          onClick={logOut}
          disabled={busy !== null}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {busy === "logout" ? <SpinnerIcon width={18} height={18} /> : null}
          Log Out
        </button>

        <Link
          href="/legal"
          className="mt-3 flex min-h-[52px] items-center justify-center rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
        >
          Legal Information
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-card p-4 sm:flex-row sm:justify-between">
        <button
          onClick={sendReset}
          disabled={busy !== null}
          className="min-h-[52px] rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "reset" ? "Sending…" : "Reset Password"}
        </button>
        <button
          onClick={deleteAccount}
          disabled={busy !== null}
          className="min-h-[52px] rounded-lg bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
        >
          {busy === "delete" ? "Deleting…" : "Delete Account"}
        </button>
      </div>

      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
