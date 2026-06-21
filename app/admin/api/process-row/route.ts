import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";

/**
 * Claude enrichment endpoint (SHELL) — Human-in-the-Loop RAG.
 *
 * Per the MedList Compliance Action Plan (§5), drug profiles must NOT be written
 * by the model from memory. The pipeline is strictly retrieval-augmented:
 *   Step 1 — Pull the raw source text for `medication_name` from an open-access
 *            New Zealand source (NZ Formulary / NZULM API). [source not yet wired]
 *   Step 2 — Send ONLY that source block to Claude (model "claude-opus-4-8")
 *            with the constraint in SYSTEM_PROMPT below.
 *   Step 3 — Return `proposed` to the admin grid for a manual clinical sanity
 *            check; Approve & Sync then commits it under the blank-or-approved
 *            rule (see sync-row). The model output is never auto-committed.
 *
 * ANTHROPIC_API_KEY is read server-side only and never exposed to the client.
 *
 * Wiring sketch (enable when the NZF/NZULM source is available):
 *   import Anthropic from "@anthropic-ai/sdk";
 *   const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
 *   const msg = await client.messages.create({
 *     model: "claude-opus-4-8",
 *     max_tokens: 4096,
 *     system: SYSTEM_PROMPT,
 *     messages: [{ role: "user", content: nzfSourceTextForMedication }],
 *   });
 *   // parse msg.content -> proposed: Record<ReferenceField, string>
 */
const SYSTEM_PROMPT =
  "Translate this specific text block into 6th-grade level patient English. " +
  "Do not extrapolate, do not insert external clinical guidance, and strictly " +
  "ignore all foreign FDA or non-NZ medication parameters. Use only the supplied " +
  "New Zealand source text. Return strict JSON keyed by the requested fields.";
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate payload shape even though generation isn't wired yet.
  try {
    await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      proposed: null,
      message:
        "Claude generation not configured yet. Add ANTHROPIC_API_KEY and an NZF source to enable.",
    });
  }

  // Key present but the NZF/NZULM retrieval source is not yet wired. Surface the
  // exact constraint that will govern generation so it's auditable from the UI.
  return NextResponse.json({
    proposed: null,
    systemPrompt: SYSTEM_PROMPT,
    message:
      "Claude pipeline scaffolded with the NZ RAG constraint, but not yet wired to a reference source. See route comments.",
  });
}
