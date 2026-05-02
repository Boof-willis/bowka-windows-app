"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { emitLeadEvent } from "@/lib/ghl";
import type { Lead } from "@/types/db";

const LeadSchema = z.object({
  customer_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().default("UT"),
  zip: z.string().optional(),
  year_built: z.coerce.number().int().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

function leadToWebhookPayload(lead: Lead, event: string) {
  return {
    event,
    lead_id: lead.id,
    customer_name: lead.customer_name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address_line1,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    status: lead.status,
    source: lead.source,
    measure_date: (lead as Lead & { measure_date?: string | null }).measure_date ?? null,
    occurred_at: new Date().toISOString(),
  };
}

export async function createLead(formData: FormData) {
  const profile = await requireProfile();
  const parsed = LeadSchema.parse(Object.fromEntries(formData.entries()));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed,
      email: parsed.email || null,
      assigned_rep_id: profile.id,
      created_by: profile.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  emitLeadEvent(leadToWebhookPayload(data as Lead, "lead.created"));
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLeadStatus(id: string, status: string) {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  emitLeadEvent(leadToWebhookPayload(data as Lead, "lead.status_changed"));
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

const MeasureSchema = z.object({
  measure_date: z.string().optional(),
  measurer_id: z.string().uuid().optional().or(z.literal("")),
  measure_notes: z.string().optional(),
});

export async function scheduleMeasure(leadId: string, formData: FormData) {
  await requireProfile();
  const parsed = MeasureSchema.parse(Object.fromEntries(formData.entries()));
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    measure_date: parsed.measure_date || null,
    measurer_id: parsed.measurer_id || null,
    measure_notes: parsed.measure_notes || null,
  };
  if (parsed.measure_date) {
    patch.status = "contacted"; // bump from 'new' to 'contacted' if scheduled
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;

  emitLeadEvent(leadToWebhookPayload(data as Lead, "lead.measure_scheduled"));
  revalidatePath(`/leads/${leadId}`);
}

export async function markMeasureCompleted(leadId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({
      measure_completed_at: new Date().toISOString(),
      status: "measured",
    })
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;

  emitLeadEvent(leadToWebhookPayload(data as Lead, "lead.measure_completed"));
  revalidatePath(`/leads/${leadId}`);
}
