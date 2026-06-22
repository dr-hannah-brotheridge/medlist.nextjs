"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MedicationListItem } from "@/lib/types";
import { SearchIcon, ChevronRightIcon } from "@/components/icons";
import {
  parseBrands,
  reorderBrandsBySearch,
  formatBrandPreview,
} from "@/lib/medicationHelpers";

export function SearchList({ rows }: { rows: MedicationListItem[] }) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.medication_name.toLowerCase().includes(q) ||
        (r.brands ?? "").toLowerCase().includes(q),
    );
  }, [query, rows]);

  return (
    <div>
      <div className="sticky top-[57px] z-20 -mx-4 mb-3 bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <SearchIcon
            width={20}
            height={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            inputMode="search"
            autoFocus
            placeholder="Search medications or brands…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpandedId(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      <p className="mb-2 px-1 text-xs text-slate-400">
        {filtered.length} of {rows.length} medications
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-card p-6 text-center text-sm text-slate-500">
          No medications match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-card">
          {filtered.map((r) => {
            const brands = parseBrands(r.brands);
            const reordered = reorderBrandsBySearch(brands, query);
            const preview = formatBrandPreview(reordered, 3);
            const isExpanded = expandedId === r.id;
            const hasBrands = brands.length > 0;

            const matchingBrands = query.trim()
              ? reordered.filter((b) =>
                  b.toLowerCase().includes(query.trim().toLowerCase()),
                )
              : reordered;

            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() =>
                    hasBrands
                      ? setExpandedId(isExpanded ? null : r.id)
                      : undefined
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {r.medication_name || "Unnamed medication"}
                    </span>
                    {preview ? (
                      <span className="block truncate text-sm text-slate-500">
                        <BrandHighlight text={preview} searchTerm={query} />
                      </span>
                    ) : null}
                  </span>
                  {hasBrands ? (
                    <ChevronRightIcon
                      width={18}
                      height={18}
                      className={
                        "shrink-0 text-slate-300 transition-transform " +
                        (isExpanded ? "rotate-90" : "")
                      }
                    />
                  ) : (
                    <Link
                      href={`/search/${r.id}`}
                      className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Details
                    </Link>
                  )}
                </button>

                {isExpanded && hasBrands ? (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {matchingBrands.length} brand
                      {matchingBrands.length !== 1 ? "s" : ""} — tap to select
                    </p>
                    <div className="flex flex-col gap-1">
                      {matchingBrands.map((brand) => (
                        <Link
                          key={brand}
                          href={`/my-meds/new?medication_id=${r.id}&selected_brand=${encodeURIComponent(brand)}`}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                        >
                          <span>
                            <BrandHighlight text={brand} searchTerm={query} />
                          </span>
                          <ChevronRightIcon
                            width={14}
                            height={14}
                            className="shrink-0 text-slate-300"
                          />
                        </Link>
                      ))}
                    </div>
                    <Link
                      href={`/search/${r.id}`}
                      className="mt-2 block text-center text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      View educational details →
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BrandHighlight({
  text,
  searchTerm,
}: {
  text: string;
  searchTerm: string;
}) {
  const q = searchTerm.trim();
  if (!q) return <>{text}</>;

  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = lower.indexOf(ql);

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <strong key={idx} className="font-semibold text-brand-700">
        {text.slice(idx, idx + ql.length)}
      </strong>,
    );
    lastIndex = idx + ql.length;
    idx = lower.indexOf(ql, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}