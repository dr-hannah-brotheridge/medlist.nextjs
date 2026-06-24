"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SpinnerIcon } from "@/components/icons";

/**
 * Client-side auth callback.
 *
 * Handles BOTH delivery methods Supabase uses:
 *  1. PKCE code in the query string (`?code=...`) — exchangeCodeForSession()
 *  2. Hash fragment (`#access_token=...`) — detected via getSession()/
 *     onAuthStateChange (magic links / email links often arrive this way).
 *
 * IMPORTANT: after detecting a session we use window.location.href = next
 * for a hard full-page navigation. This is more reliable than router.replace
 * for post-auth redirects because it guarantees the server sees the new auth
 * cookie when rendering the protected route layout (which calls getUser()),
 * preventing a redirect-to-login / onboarding loop.
 *
 * If exchangeCodeForSession fails (e.g. PKCE code verifier mismatch when
 * the email link opens in a different browser session), we fall through to
 * try getSession() and onAuthStateChange before showing an error.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-surface px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <SpinnerIcon width={28} height={28} className="text-brand-600" />
            <p className="font-semibold text-slate-800">Signing you in…</p>
          </div>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const next = searchParams.get("next") || "/home";
    let done = false;

    async function navigateAfterSession() {
      try {
        const { syncOnboardingDraft } = await import("@/lib/onboarding");
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await syncOnboardingDraft(data.session.user.id);
        }
      } catch {
        /* non-fatal */
      }
      window.location.href = next;
    }

    async function tryCodeExchange() {
      const code = searchParams.get("code");
      if (!code) return false;

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        done = true;
        await navigateAfterSession();
        return true;
      }

      const { error: error2 } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      if (!error2) {
        done = true;
        await navigateAfterSession();
        return true;
      }

      return false;
    }

    async function tryHashSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        done = true;
        await navigateAfterSession();
        return true;
      }
      return false;
    }

    (async () => {
      await new Promise((r) => setTimeout(r, 500));

      const handled = (await tryCodeExchange()) || (await tryHashSession());
      if (!handled && !done) {
        setTimeout(async () => {
          if (done) return;
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            done = true;
            await navigateAfterSession();
          }
        }, 2000);

        const { data: sub } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (
              (event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED" ||
                event === "INITIAL_SESSION") &&
              session &&
              !done
            ) {
              done = true;
              sub.subscription.unsubscribe();
              await navigateAfterSession();
            }
          },
        );

        setTimeout(() => {
          if (!done) {
            sub.subscription.unsubscribe();
            setError(
              "Sign-in link expired or is invalid. Please request a new link.",
            );
          }
        }, 15000);
      }
    })();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : (
          <>
            <SpinnerIcon width={28} height={28} className="text-brand-600" />
            <p className="font-semibold text-slate-800">Signing you in…</p>
            <p className="text-sm text-slate-600">
              Please wait while we verify your link.
            </p>
          </>
        )}
      </div>
    </main>
  );
}