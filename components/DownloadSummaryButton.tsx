"use client";

import { useState } from "react";
import { DownloadIcon, SpinnerIcon } from "@/components/icons";

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function DownloadSummaryButton({ userId }: { userId: string }) {
  // userId kept in the API for parity/consistency; auth is cookie-based.
  void userId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/summary/pdf", { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error(`Could not generate the summary (${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "medlist-doctor-summary.pdf");
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not generate the summary.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onDownload}
        disabled={loading}
        aria-label="Download summary PDF"
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? (
          <SpinnerIcon width={20} height={20} />
        ) : (
          <DownloadIcon width={20} height={20} />
        )}
      </button>
      {error ? (
        <span className="max-w-[12rem] text-right text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}