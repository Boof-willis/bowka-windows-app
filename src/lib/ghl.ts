// Outbound webhook helper for GoHighLevel.
// Fire-and-forget — never throws or blocks the calling action. We log
// failures so they're visible in dev, but a webhook outage shouldn't
// break the user-facing flow.

import { createServiceClient } from "@/lib/supabase/server";

type WebhookEventType = "lead" | "job";

interface LeadEventPayload {
  event: string; // 'lead.created' | 'lead.status_changed' | 'lead.measure_scheduled' etc
  lead_id: string;
  customer_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status: string;
  source?: string | null;
  measure_date?: string | null;
  occurred_at: string;
}

interface JobEventPayload {
  event: string; // 'job.created' | 'job.status_changed' | 'job.completed' etc
  job_id: string;
  job_number: string | null;
  customer_name: string;
  status: string;
  scheduled_install_date?: string | null;
  installed_at?: string | null;
  completed_at?: string | null;
  contract_total_cents?: number | null;
  occurred_at: string;
}

async function getWebhookUrl(type: WebhookEventType): Promise<string | null> {
  const key = `ghl_webhook_${type}`;
  // Use service-role to read settings (bypasses any future RLS on this table)
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const url = data?.value?.trim();
  if (!url) return null;
  if (!/^https?:\/\//.test(url)) return null;
  return url;
}

async function fire(type: WebhookEventType, payload: object) {
  const url = await getWebhookUrl(type);
  if (!url) return; // No webhook configured — silently skip
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Hard timeout — we don't want to hang server actions on a slow webhook
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[ghl] ${type} webhook returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[ghl] ${type} webhook failed:`, err);
  }
}

export function emitLeadEvent(payload: LeadEventPayload) {
  // Fire-and-forget — don't await
  void fire("lead", payload);
}

export function emitJobEvent(payload: JobEventPayload) {
  void fire("job", payload);
}
