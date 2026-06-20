import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERENCE_FIELDS, type ReferenceField } from "@/lib/constants";

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/**
 * Conditional update of a total_medications row.
 * Rule: a column is updated ONLY IF the current DB value is blank/null, OR the
 * admin explicitly approved (approve=true). Populated reference text is never
 * blind-overwritten. Reads the current row first to enforce this server-side.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: number; values?: Record<string, string>; approve?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, values, approve } = body;
  if (typeof id !== "number" || !values || typeof values !== "object") {
    return NextResponse.json({ error: "id and values are required" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Service role key not configured." },
      { status: 501 },
    );
  }

  // Read the current row to compare against existing (populated) values.
  const { data: current, error: readError } = await supabase
    .from("total_medications")
    .select(["id", ...REFERENCE_FIELDS].join(","))
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  const currentRow = current as unknown as Record<ReferenceField, string | null>;
  const patch: Partial<Record<ReferenceField, string | null>> = {};
  const updated: string[] = [];

  for (const field of REFERENCE_FIELDS) {
    const incoming = (values[field] ?? "").trim();
    const existing = currentRow[field];
    const changed = incoming !== (existing ?? "").trim();
    if (!changed) continue;
    // Allow the write only when the existing value is blank, or admin approved.
    if (isBlank(existing) || approve === true) {
      patch[field] = incoming === "" ? null : incoming;
      updated.push(field);
    }
  }

  if (updated.length === 0) {
    return NextResponse.json({ ok: true, updated: [] });
  }

  const { error: updateError } = await supabase
    .from("total_medications")
    .update(patch)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated });
}
