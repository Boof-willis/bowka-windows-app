"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";

export async function updateJob(jobId: string, payload: Record<string, unknown>) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
  if (error) throw error;
  revalidatePath(`/jobs/${jobId}`);
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
