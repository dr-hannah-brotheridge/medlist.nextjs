import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";

/**
 * Claude enrichment endpoint (SHELL).
 *
 * Future: take reference source text (e.g. an NZF entry) for `medication_name`,
 * call the Claude API (model "claude-opus-4-8") to rewrite it into plain
 * NZ-English layman terms for each REFERENCE_FIELD, and return a `proposed`
 * object. The admin reviews the proposed text in the grid, then Approve & Sync
 * applies it under the blank-or-approved rule (see sync-row).
 *
 * The ANTHROPIC_API_KEY is read server-side only and never exposed to the client.
 *
 * Wiring sketch (enable when an NZF source/feed and the key are available):
 *
 *   import Anthropic from "@anthropic-ai/sdk";
 *   const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
 *   const msg = await client.messages.create({
 *     model: "claude-opus-4-8",
 *     max_tokens: 4096,
 *     system: "Rewrite NZ clinical medicine text into plain, layman NZ English. " +
 *             "Return strict JSON keyed by the requested fields.",
 *     messages: [{ role: "user", content: nzfSourceTextForMedication }],
 *   });
 *   // parse msg.content -> proposed: Record<ReferenceField, string>
 */
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

  // Key present but generation pipeline not yet implemented.
  return NextResponse.json({
    proposed: null,
    message:
      "Claude pipeline scaffolded but not yet wired to a reference source. See route comments.",
  });
}
