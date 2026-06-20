"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MedicationListItem } from "@/lib/types";
import { SearchIcon, ChevronRightIcon } from "@/components/icons";

export function SearchList({ rows }: { rows: MedicationListItem[] }) {
  const [query, setQuery] = useState("");

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
            placeholder="Search medications…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      <p className="mb-2 px-1 text-xs text-slate-400">
        {filtered.length} of {rows.length} medications
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-card p-6 text-center text-sm text-slate-500">
          No medications match “{query}”.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-card">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/search/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">
                    {r.medication_name}
                  </span>
                  {r.brands ? (
                    <span className="block truncate text-sm text-slate-500">
                      {r.brands}
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon
                  width={18}
                  height={18}
                  className="shrink-0 text-slate-300"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
