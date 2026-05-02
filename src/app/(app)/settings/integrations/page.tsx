import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function updateSetting(formData: FormData) {
  "use server";
  const profile = await requireRole("admin");
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase
    .from("integration_settings")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    });
  revalidatePath("/settings/integrations");
}

export default async function IntegrationsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("integration_settings")
    .select("*")
    .order("key");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>GoHighLevel webhooks</CardTitle>
          <CardDescription>
            Outbound only — Boka Glass POSTs JSON to your GHL webhook URLs when leads or jobs change.
            Configure inbound triggers / workflows on the GHL side. Payloads include event type,
            entity ID, customer name, status, and timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(settings ?? []).map((s) => (
            <form key={s.key} action={updateSetting} className="space-y-2">
              <input type="hidden" name="key" value={s.key} />
              <div>
                <Label htmlFor={s.key} className="font-mono text-xs">{s.key}</Label>
                {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
              </div>
              <div className="flex gap-2">
                <Input
                  id={s.key}
                  name="value"
                  type="url"
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                  defaultValue={s.value ?? ""}
                />
                <Button type="submit" variant="outline">Save</Button>
              </div>
              {s.value && (
                <p className="text-xs text-emerald-700">Active — events will fire to this URL.</p>
              )}
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook events</CardTitle>
        </CardHeader>
        <CardContent>
          <Section title="Lead webhook fires on">
            <ul className="ml-4 list-disc text-sm text-muted-foreground">
              <li><code className="font-mono">lead.created</code> — new lead added</li>
              <li><code className="font-mono">lead.status_changed</code> — status moves (new → measured → quoted → won/lost)</li>
              <li><code className="font-mono">lead.measure_scheduled</code> — measure date set</li>
              <li><code className="font-mono">lead.measure_completed</code> — rep marked measure done</li>
            </ul>
          </Section>
          <Section title="Job webhook fires on">
            <ul className="ml-4 list-disc text-sm text-muted-foreground">
              <li><code className="font-mono">job.status_changed</code> — kanban drag, including completion</li>
              <li><code className="font-mono">job.manufacturer_ordered</code> — order sent to supplier</li>
            </ul>
          </Section>
          <Section title="Suggested GHL workflows to wire up">
            <ul className="ml-4 list-disc text-sm text-muted-foreground">
              <li>On <code>lead.measure_scheduled</code> → SMS confirmation + 24h-before reminder</li>
              <li>On <code>job.status_changed</code> to <code>scheduled</code> → SMS install date confirmation</li>
              <li>On <code>job.status_changed</code> to <code>completed</code> → 48h delay → review request SMS</li>
            </ul>
          </Section>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}
