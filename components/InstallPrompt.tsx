"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, CloseIcon } from "@/components/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Cross-browser "Install app" affordance.
 *
 * - Chrome / Edge / Android: listens for `beforeinstallprompt`, captures it,
 *   and shows a tappable button that triggers the native install dialog.
 * - iOS Safari (which never fires the above event): detects iPhone/iPad and
 *   shows a small, dismissible hint card explaining "Share → Add to Home Screen".
 * - Desktop browsers without support: renders nothing.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">(
    "other",
  );

  useEffect(() => {
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPlatform(isAndroid ? "android" : isIOS ? "ios" : "other");

    const dismissed = localStorage.getItem("medlist-install-dismissed");

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!dismissed) setShowCard(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (platform === "ios") {
      const dismissed = localStorage.getItem("medlist-install-dismissed");
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      if (!dismissed && !standalone) setShowCard(true);
    }
  }, [platform]);

  function dismiss() {
    setShowCard(false);
    localStorage.setItem("medlist-install-dismissed", "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
      setShowCard(false);
    } else {
      dismiss();
    }
  }

  if (!showCard) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-lg px-4">
      <div className="flex items-center gap-3 rounded-xl border border-brand-300 bg-card p-3 shadow-lg">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <DownloadIcon width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Install MedList</p>
          {platform === "ios" ? (
            <p className="text-sm text-slate-600">
              Tap the Safari Share button, then “Add to Home Screen”.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Add MedList to your home screen for quick, offline access.
            </p>
          )}
        </div>
        {platform !== "ios" ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700"
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <CloseIcon width={18} height={18} />
        </button>
      </div>
    </div>
  );
}