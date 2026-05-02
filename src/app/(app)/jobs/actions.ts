"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { emitJobEvent } from "@/lib/ghl";

interface JobWithCustomer {
  id: string;
  job_number: string | null;
  status: string;
  scheduled_install_date: string | null;
  installed_at: string | null;
  completed_at: string | null;
  quote: {
    total_cents: number;
    lead: { customer_name: string } | null;
  } | null;
}

async function fetchJobForWebhook(jobId: string): Promise<JobWithCustomer | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, job_number, status, scheduled_install_date, installed_at, completed_at, quote:quotes(total_cents, lead:leads(customer_name))")
    .eq("id", jobId)
    .single();
  return data as unknown as JobWithCustomer;
}

function jobToWebhook(job: JobWithCustomer | null, event: string) {
  if (!job) return null;
  return {
    event,
    job_id: job.id,
    job_number: job.job_number,
    customer_name: job.quote?.lead?.customer_name ?? "—",
    status: job.status,
    scheduled_install_date: job.scheduled_install_date,
    installed_at: job.installed_at,
    completed_at: job.completed_at,
    contract_total_cents: job.quote?.total_cents ?? null,
    occurred_at: new Date().toISOString(),
  };
}

export async function updateJob(jobId: string, payload: Record<string, unknown>) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
  if (error) throw error;
  revalidatePath(`/jobs/${jobId}`);
}

const JobStatuses = [
  "pending_order",
  "ordered",
  "in_production",
  "ready_to_install",
  "scheduled",
  "installed",
  "completed",
  "cancelled",
] as const;

export async function updateJobStatus(jobId: string, status: string) {
  await requireRole("admin");
  if (!(JobStatuses as readonly string[]).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  // Auto-stamp timestamps when crossing certain stages
  if (status === "installed") patch.installed_at = new Date().toISOString();
  if (status === "completed") patch.completed_at = new Date().toISOString();
  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) throw error;

  const webhookPayload = jobToWebhook(await fetchJobForWebhook(jobId), "job.status_changed");
  if (webhookPayload) emitJobEvent(webhookPayload);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

export async function markManufacturerOrderSent(jobId: string, formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();

  const manufacturerId = String(formData.get("manufacturer_id") ?? "").trim();
  const sentTo = String(formData.get("sent_to") ?? "").trim();
  const orderNumber = String(formData.get("order_number") ?? "").trim();

  const patch: Record<string, unknown> = {
    manufacturer_order_sent_at: new Date().toISOString(),
    manufacturer_order_sent_to: sentTo || null,
    manufacturer_order_placed_at: new Date().toISOString(),
  };
  if (manufacturerId) patch.manufacturer_id = manufacturerId;
  if (orderNumber) patch.manufacturer_order_number = orderNumber;

  // If still in pending_order, advance to ordered
  const { data: existing } = await supabase.from("jobs").select("status, manufacturer_name").eq("id", jobId).single();
  if (existing?.status === "pending_order") patch.status = "ordered";

  // If a manufacturer was picked, copy the name onto the job for display
  if (manufacturerId) {
    const { data: m } = await supabase.from("manufacturers").select("name").eq("id", manufacturerId).single();
    if (m?.name) patch.manufacturer_name = m.name;
  }

  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) throw error;

  const webhookPayload = jobToWebhook(await fetchJobForWebhook(jobId), "job.manufacturer_ordered");
  if (webhookPayload) emitJobEvent(webhookPayload);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

const LaborPayoutSchema = z.object({
  payout_cents: z.coerce.number().int().min(0),
  payout_type: z.string().optional(),
  payee_id: z.string().uuid().optional().nullable(),
  paid_at: z.string().optional(),
  notes: z.string().optional(),
});

export async function addLaborPayout(jobId: string, formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();
  const raw = Object.fromEntries(formData.entries());
  const parsed = LaborPayoutSchema.parse({
    ...raw,
    payout_cents: Math.round(parseFloat(String(raw.payout ?? "0")) * 100),
  });
  await supabase.from("labor_payouts").insert({ ...parsed, job_id: jobId });
  revalidatePath(`/jobs/${jobId}`);
}

export async function addConsumableOverride(jobId: string, formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const key = String(formData.get("consumable_key") ?? "");
  const cost = Math.round(parseFloat(String(formData.get("cost") ?? "0")) * 100);
  const qty = parseFloat(String(formData.get("quantity") ?? "1"));
  const notes = String(formData.get("notes") ?? "") || null;
  await supabase.from("job_consumables").insert({
    job_id: jobId,
    consumable_key: key,
    quantity: qty,
    total_cost_cents: cost,
    notes,
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function addDumpTrip(jobId: string, formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const trip_date = String(formData.get("trip_date") ?? new Date().toISOString().slice(0, 10));
  const fee = Math.round(parseFloat(String(formData.get("fee") ?? "0")) * 100);
  const weight = parseFloat(String(formData.get("weight") ?? "0")) || null;
  const windowsHauled = parseInt(String(formData.get("windows_hauled") ?? "0")) || null;

  const { data: trip, error } = await supabase
    .from("dump_trips")
    .insert({ trip_date, fee_cents: fee, weight_tonnes: weight, windows_hauled: windowsHauled })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("dump_trip_jobs").insert({
    dump_trip_id: trip.id,
    job_id: jobId,
    windows_from_job: windowsHauled ?? 0,
  });

  revalidatePath(`/jobs/${jobId}`);
}
