import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { createQuoteForLead } from "../../quotes/actions";
import { scheduleMeasure, markMeasureCompleted } from "../actions";

interface LeadWithMeasure {
  id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  year_built: number | null;
  status: string;
  source: string | null;
  notes: string | null;
  measure_date: string | null;
  measurer_id: string | null;
  measure_notes: string | null;
  measure_completed_at: string | null;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "sales_rep");
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single<LeadWithMeasure>();
  if (!lead) notFound();

  const [{ data: quotes }, { data: people }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, quote_number, status, total_cents, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, role").eq("active", true),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/leads" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.customer_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="capitalize">{lead.status}</Badge>
            {lead.source && <span>· {lead.source}</span>}
          </div>
        </div>
        <form action={async () => {
          "use server";
          await createQuoteForLead(id);
        }}>
          <Button type="submit">Build quote</Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV label="Phone" value={lead.phone} />
            <KV label="Email" value={lead.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV label="Street" value={lead.address_line1} />
            <KV label="City/State/Zip" value={[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")} />
            <KV label="Year built" value={lead.year_built?.toString() ?? null} />
          </CardContent>
        </Card>
      </div>

      {/* Measure appointment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Measure appointment</CardTitle>
          <CardDescription>
            {lead.measure_completed_at
              ? `Completed ${new Date(lead.measure_completed_at).toLocaleDateString()} — ready to quote.`
              : lead.measure_date
                ? `Scheduled for ${new Date(lead.measure_date).toLocaleString()}.`
                : "Schedule when the rep will measure on-site."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={scheduleMeasure.bind(null, id)} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="measure_date">Date / time</Label>
              <Input
                id="measure_date"
                name="measure_date"
                type="datetime-local"
                defaultValue={lead.measure_date ? new Date(lead.measure_date).toISOString().slice(0, 16) : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="measurer_id">Measurer</Label>
              <Select name="measurer_id" defaultValue={lead.measurer_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
                <SelectContent>
                  {(people ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email} ({p.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline" className="w-full">Save</Button>
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="measure_notes">Notes</Label>
              <Textarea
                id="measure_notes"
                name="measure_notes"
                rows={2}
                defaultValue={lead.measure_notes ?? ""}
                placeholder="Gate code, dogs, parking, etc."
              />
            </div>
          </form>
          {lead.measure_date && !lead.measure_completed_at && (
            <form action={async () => {
              "use server";
              await markMeasureCompleted(id);
            }} className="mt-3">
              <Button type="submit" size="sm">
                <CheckCircle2 className="h-4 w-4" /> Mark measure completed
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {lead.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{lead.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Quotes</CardTitle></CardHeader>
        <CardContent>
          {(quotes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes yet.</p>
          ) : (
            <div className="space-y-2">
              {quotes!.map((q) => (
                <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50">
                  <div>
                    <div className="font-medium">{q.quote_number ?? q.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{q.status}</Badge>
                    <div className="font-medium">{formatMoney(q.total_cents)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
