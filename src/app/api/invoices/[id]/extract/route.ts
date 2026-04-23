import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured data from window manufacturer invoices.
You will be given a PDF invoice. Extract each line item (one per window) into the JSON schema below.
Return STRICT JSON only — no markdown, no commentary.

Schema:
{
  "manufacturer_name": string | null,
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "total_cents": integer (total invoice dollar amount × 100),
  "windows": [
    {
      "position": integer (1-indexed row),
      "location_label": string | null (e.g. "Front Room", "Master Bath"),
      "window_type": one of "picture" | "single_hung" | "double_hung" | "single_slider" | "double_slider" | "casement" | "awning" | "bay" | "bow" | "garden" | "custom",
      "fin_type": one of "nail_fin" | "flush_fin" | "block_frame" | "retrofit" | null,
      "width_inches": number,
      "height_inches": number,
      "color": string | null,
      "glass_type": string | null (e.g. "LoE 366"),
      "tempered": boolean,
      "obscured": boolean,
      "grid": boolean,
      "storms": boolean,
      "wraps": boolean,
      "tinted": boolean,
      "tint_color": string | null,
      "operation": one of "fixed" | "up" | "down" | "xo" | "ox" | "xox" | "oxo" | null,
      "cost_cents": integer (per-unit cost × 100)
    }
  ]
}

If a field is not explicitly stated, use null (or false for booleans). Do NOT guess cost_cents — if per-line costs aren't shown and only an invoice total is, set each window's cost_cents to null and put the full amount in total_cents.`;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await ctx.params;

  const supabase = await createClient();
  const service = createServiceClient();

  const { data: invoice, error: invErr } = await supabase
    .from("manufacturer_invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? "not found" }, { status: 404 });
  }

  await supabase.from("manufacturer_invoices").update({ extraction_status: "processing" }).eq("id", id);

  // Download file from storage
  const { data: blob, error: dlErr } = await supabase.storage
    .from("manufacturer-invoices")
    .download(invoice.file_path);
  if (dlErr || !blob) {
    await supabase.from("manufacturer_invoices").update({ extraction_status: "failed", notes: dlErr?.message }).eq("id", id);
    return NextResponse.json({ error: dlErr?.message }, { status: 500 });
  }

  const arrayBuf = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mime = invoice.file_mime ?? "application/pdf";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  let extracted: Record<string, unknown> | null = null;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            mime === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
              : { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: base64 } },
            { type: "text", text: "Extract the invoice per the schema. Return JSON only." },
          ],
        },
      ],
    });

    const textBlock = msg.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("no text response");
    const raw = textBlock.text.trim().replace(/^```json\s*/, "").replace(/```$/, "");
    extracted = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("manufacturer_invoices")
      .update({ extraction_status: "failed", notes: message })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Persist extraction + update windows table
  const windowsList = Array.isArray(extracted?.windows) ? (extracted!.windows as Array<Record<string, unknown>>) : [];

  await service
    .from("manufacturer_invoices")
    .update({
      manufacturer_name: (extracted?.manufacturer_name as string) ?? null,
      invoice_number: (extracted?.invoice_number as string) ?? null,
      invoice_date: (extracted?.invoice_date as string) ?? null,
      total_cents: Math.round(Number(extracted?.total_cents ?? 0)),
      extraction_status: "completed",
      extraction_raw: extracted,
      extracted_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Update windows.actual_cost_cents by matching on position — if manufacturer invoice
  // has per-line costs and our quote windows exist at the same position, update them.
  const { data: job } = await service.from("jobs").select("quote_id").eq("id", invoice.job_id).single();
  if (job) {
    const { data: quoteWindows } = await service
      .from("windows")
      .select("id, position")
      .eq("quote_id", job.quote_id);

    const byPos = new Map<number, string>();
    (quoteWindows ?? []).forEach((w) => byPos.set(w.position, w.id));

    for (const w of windowsList) {
      const pos = Number(w.position);
      const cost = w.cost_cents != null ? Math.round(Number(w.cost_cents)) : null;
      if (cost == null) continue;
      const windowId = byPos.get(pos);
      if (windowId) {
        await service.from("windows").update({ actual_cost_cents: cost }).eq("id", windowId);
      }
    }

    // Roll up job total
    const { data: updatedWindows } = await service
      .from("windows")
      .select("actual_cost_cents")
      .eq("quote_id", job.quote_id);
    const materialCost = (updatedWindows ?? [])
      .filter((w) => w.actual_cost_cents != null)
      .reduce((s, w) => s + (w.actual_cost_cents ?? 0), 0);
    await service
      .from("jobs")
      .update({ actual_material_cost_cents: materialCost })
      .eq("id", invoice.job_id);
  }

  return NextResponse.json({ ok: true, extracted });
}
