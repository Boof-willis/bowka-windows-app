import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { createQuoteForLead } from "../../quotes/actions";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "sales_rep");
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_number, status, total_cents, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

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
