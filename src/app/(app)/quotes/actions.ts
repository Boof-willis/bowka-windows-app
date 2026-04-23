"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Window } from "@/types/db";

export async function createQuoteForLead(leadId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Quote number: Q-YYYY-NNNN
  const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
  const quoteNumber = `Q-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      lead_id: leadId,
      sales_rep_id: profile.id,
      quote_number: quoteNumber,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("leads").update({ status: "quoted" }).eq("id", leadId);

  redirect(`/quotes/${quote.id}`);
}

const WindowSchema = z.object({
  position: z.coerce.number().int().min(1),
  location_label: z.string().min(1),
  window_type: z.string(),
  fin_type: z.string().nullable().optional(),
  width_inches: z.coerce.number().positive(),
  height_inches: z.coerce.number().positive(),
  color: z.string().optional(),
  glass_type: z.string().optional(),
  tempered: z.coerce.boolean().optional(),
  obscured: z.coerce.boolean().optional(),
  grid: z.coerce.boolean().optional(),
  storms: z.coerce.boolean().optional(),
  wraps: z.coerce.boolean().optional(),
  tinted: z.coerce.boolean().optional(),
  tint_color: z.string().optional(),
  operation: z.string().optional(),
  quoted_price_cents: z.coerce.number().int().min(0),
});

export async function saveQuoteWindows(quoteId: string, windows: unknown[]) {
  await requireProfile();
  const supabase = await createClient();
  const parsed = windows.map((w) => WindowSchema.parse(w));

  // Simplest approach: delete all then re-insert. Fine for v1 (quotes are small).
  await supabase.from("windows").delete().eq("quote_id", quoteId);
  if (parsed.length > 0) {
    const rows = parsed.map((p) => ({ ...p, quote_id: quoteId }));
    const { error } = await supabase.from("windows").insert(rows);
    if (error) throw error;
  }

  // Recompute quote totals
  const subtotal = parsed.reduce((s, p) => s + p.quoted_price_cents, 0);
  await supabase
    .from("quotes")
    .update({ subtotal_cents: subtotal, total_cents: subtotal })
    .eq("id", quoteId);

  revalidatePath(`/quotes/${quoteId}`);
}

export async function updateQuoteMeta(quoteId: string, payload: Partial<{
  payment_method: string | null;
  loan_plan_id: string | null;
  down_payment_cents: number | null;
  exterior_substrate: string | null;
  install_notes: string | null;
  existing_frame_material: string | null;
  discount_cents: number;
  tax_cents: number;
  redline_total_cents: number | null;
}>) {
  await requireProfile();
  const supabase = await createClient();

  if (payload.discount_cents != null || payload.tax_cents != null) {
    const { data: q } = await supabase
      .from("quotes")
      .select("subtotal_cents, discount_cents, tax_cents")
      .eq("id", quoteId)
      .single();
    if (q) {
      const subtotal = q.subtotal_cents;
      const discount = payload.discount_cents ?? q.discount_cents ?? 0;
      const tax = payload.tax_cents ?? q.tax_cents ?? 0;
      (payload as Record<string, unknown>).total_cents = subtotal - discount + tax;
    }
  }

  const { error } = await supabase.from("quotes").update(payload).eq("id", quoteId);
  if (error) throw error;
  revalidatePath(`/quotes/${quoteId}`);
}

export async function sendQuote(quoteId: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function acceptQuote(quoteId: string) {
  await requireProfile();
  const supabase = await createClient();
  // status=accepted triggers job creation via DB trigger
  await supabase
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", quoteId);

  const { data: q } = await supabase.from("quotes").select("lead_id").eq("id", quoteId).single();
  if (q) {
    await supabase.from("leads").update({ status: "won" }).eq("id", q.lead_id);
  }

  // Find the created job to redirect
  const { data: job } = await supabase.from("jobs").select("id").eq("quote_id", quoteId).single();
  revalidatePath(`/quotes/${quoteId}`);
  if (job) redirect(`/jobs/${job.id}`);
}

export type WindowDraft = Partial<Window> & {
  position: number;
  location_label: string;
  width_inches: number;
  height_inches: number;
};
