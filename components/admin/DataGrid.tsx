"use client";

import { useMemo, useState } from "react";
import {
  REFERENCE_FIELDS,
  REFERENCE_FIELD_LABELS,
  type ReferenceField,
} from "@/lib/constants";
import type { TotalMedication } from "@/lib/types";

type RowStatus = "idle" | "generating" | "syncing" | "synced" | "error";

export function DataGrid({ initialRows }: { initialRows: TotalMedication[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter((r) =>
      (r.medication_name ?? "").toLowerCase().includes(q),
    );
  }, [query, initialRows]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="search"
          placeholder="Filter by medication name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        />
        <span className="text-xs text-slate-400">
          {filtered.length} rows · empty cells highlighted
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-card">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                ID
              </th>
              {REFERENCE_FIELDS.map((f) => (
                <th
                  key={f}
                  className="min-w-[180px] px-3 py-2 text-left font-semibold text-slate-600"
                >
                  {REFERENCE_FIELD_LABELS[f]}
                </th>
              ))}
              <th className="sticky right-0 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <RowEditor key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowEditor({ row }: { row: TotalMedication }) {
  // Per-row local state keeps typing in one row from re-rendering the whole grid.
  const [values, setValues] = useState<Record<ReferenceField, string>>(() => {
    const init = {} as Record<ReferenceField, string>;
    for (const f of REFERENCE_FIELDS) init[f] = (row[f] as string) ?? "";
    return init;
  });
  const [status, setStatus] = useState<RowStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function setField(f: ReferenceField, v: string) {
    setStatus("idle");
    setValues((prev) => ({ ...prev, [f]: v }));
  }

  async function generate() {
    setStatus("generating");
    setMessage(null);
    try {
      const res = await fetch("/admin/api/process-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, medication_name: row.medication_name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed");
      if (body.proposed) {
        // Only fill blank cells with proposed text; never clobber existing.
        setValues((prev) => {
          const next = { ...prev };
          for (const f of REFERENCE_FIELDS) {
            if (!next[f] && body.proposed[f]) next[f] = body.proposed[f];
          }
          return next;
        });
        setMessage("Proposed text filled into blank cells — review then Approve & Sync.");
      } else {
        setMessage(body.message ?? "Not yet configured.");
      }
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Generation failed");
    }
  }

  async function sync(approve: boolean) {
    setStatus("syncing");
    setMessage(null);
    try {
      const res = await fetch("/admin/api/sync-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, values, approve }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync failed");
      setStatus("synced");
      setMessage(
        body.updated?.length
          ? `Synced: ${body.updated.join(", ")}`
          : "No changes to sync.",
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 font-mono text-xs text-slate-400">{row.id}</td>
      {REFERENCE_FIELDS.map((f) => {
        const isBlank = !values[f];
        return (
          <td key={f} className="px-2 py-2">
            <textarea
              value={values[f]}
              onChange={(e) => setField(f, e.target.value)}
              rows={2}
              className={
                "w-full min-w-[170px] rounded-md border px-2 py-1 text-xs outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 " +
                (isBlank
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white")
              }
            />
          </td>
        );
      })}
      <td className="sticky right-0 bg-card px-3 py-2">
        <div className="flex w-44 flex-col gap-1.5">
          <button
            onClick={generate}
            disabled={status === "generating" || status === "syncing"}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {status === "generating" ? "Generating…" : "Generate (Claude)"}
          </button>
          <button
            onClick={() => sync(false)}
            disabled={status === "syncing"}
            className="rounded-md border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
          >
            Sync blanks only
          </button>
          <button
            onClick={() => sync(true)}
            disabled={status === "syncing"}
            className="rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {status === "syncing" ? "Syncing…" : "Approve & Sync"}
          </button>
          {message ? (
            <p
              className={
                "text-[11px] leading-tight " +
                (status === "error" ? "text-red-600" : "text-slate-500")
              }
            >
              {message}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
