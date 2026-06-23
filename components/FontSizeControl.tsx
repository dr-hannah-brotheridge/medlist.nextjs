"use client";

import { useEffect, useState } from "react";

type Size = "base" | "lg" | "xl";

const SIZES: { id: Size; label: string }[] = [
  { id: "base", label: "A" },
  { id: "lg", label: "A+" },
  { id: "xl", label: "A++" },
];

const STORAGE_KEY = "medlist-fontsize";

/**
 * Dead-simple font scale utility shown at the top of the authenticated shell.
 * Persists the choice to localStorage and applies `data-fontsize` on <html>,
 * which `globals.css` turns into a root font-size scale (1rem = 16/18/20px).
 */
export function FontSizeControl() {
  const [size, setSize] = useState<Size>("base");
  const [mounted, setMounted] = useState(false);

  // Read persisted preference on mount (client-only to avoid SSR mismatch).
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as Size | null;
    if (stored === "lg" || stored === "xl") {
      setSize(stored);
      document.documentElement.setAttribute("data-fontsize", stored);
    }
  }, []);

  function apply(next: Size) {
    setSize(next);
    if (next === "base") {
      document.documentElement.removeAttribute("data-fontsize");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.setAttribute("data-fontsize", next);
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  if (!mounted) return null;

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Text size"
    >
      <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
        Text size:
      </span>
      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        {SIZES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => apply(id)}
            aria-pressed={size === id}
            className={
              "min-h-[48px] min-w-[48px] px-3 font-bold transition " +
              (size === id
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100")
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}