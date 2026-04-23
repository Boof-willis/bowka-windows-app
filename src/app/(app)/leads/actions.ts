"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

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
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLeadStatus(id: string, status: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw error;
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}
