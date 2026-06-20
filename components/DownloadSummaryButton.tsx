"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-doctor-summary",
        { body: { user_id: userId } },
      );
      if (error) throw error;

      const filename = "medlist-doctor-summary.pdf";

      // Shape 1: a Blob (PDF bytes returned directly).
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data);
        triggerDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      // Shape 2: JSON with a signed URL.
      else if (data && typeof data === "object" && "url" in data) {
        triggerDownload(String((data as { url: string }).url), filename);
      }
      // Shape 3: a raw string that is a URL.
      else if (typeof data === "string" && data.startsWith("http")) {
        triggerDownload(data, filename);
      } else {
        // Fallback: raw fetch so binary isn't mis-parsed as text.
        await rawFetchFallback(userId, filename);
      }
    } catch (e) {
      try {
        await rawFetchFallback(userId, "medlist-doctor-summary.pdf");
      } catch {
        setError(
          e instanceof Error ? e.message : "Could not generate the summary.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function rawFetchFallback(uid: string, filename: string) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-doctor-summary`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ user_id: uid }),
      },
    );
    if (!res.ok) throw new Error(`Summary failed (${res.status})`);

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      if (json?.url) {
        triggerDownload(String(json.url), filename);
        return;
      }
      throw new Error("Unexpected response from summary function.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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
