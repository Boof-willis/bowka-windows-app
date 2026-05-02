import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, FileSignature } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canSeeCosts } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { QuoteBuilder } from "./quote-builder";
import { recordFinancingApproval, recordContractSigned } from "../actions";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: quoteRef } = await supabase.from("quotes").select("lead_id").eq("id", id).single();

  const [{ data: quote }, { data: windows }, { data: lead }, { data: loanPlans }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("windows").select("*").eq("quote_id", id).order("position"),
    supabase.from("leads").select("*").eq("id", quoteRef?.lead_id ?? "").single(),
    supabase.from("loan_plans").select("*, lender:lenders(name)").eq("active", true).order("plan_code"),
  ]);

  if (!quote) notFound();

  const isFinance = quote.payment_method === "finance";
  const showFinancingPanel = isFinance && quote.status !== "draft";
  const showContractPanel = quote.status === "sent" || quote.status === "accepted";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href={`/leads/${quote.lead_id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to lead
      </Link>
      <QuoteBuilder
        quote={quote}
        windows={windows ?? []}
        lead={lead}
        loanPlans={loanPlans ?? []}
        canSeeCosts={canSeeCosts(profile.role)}
        viewerRole={profile.role}
      />

      {showFinancingPanel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financing approval</CardTitle>
            <CardDescription>
              {quote.financing_status === "approved" ? (
                <>
                  Approved {quote.financing_approved_at && `on ${new Date(quote.financing_approved_at).toLocaleDateString()}`}
                  {quote.financing_approved_amount_cents && ` for ${formatMoney(quote.financing_approved_amount_cents)}`}
                  {quote.financing_application_id && ` · App #${quote.financing_application_id}`}
                </>
              ) : (
                <>Run the credit app at the lender portal, then enter the result below.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={recordFinancingApproval.bind(null, id)} className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="financing_status">Result</Label>
                <select
                  name="financing_status"
                  id="financing_status"
                  defaultValue={quote.financing_status ?? "approved"}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approved_amount">Approved amount ($)</Label>
                <Input
                  id="approved_amount"
                  name="approved_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={quote.financing_approved_amount_cents ? (quote.financing_approved_amount_cents / 100).toFixed(2) : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan_code">Plan code</Label>
                <Input
                  id="plan_code"
                  name="plan_code"
                  defaultValue={loanPlans?.find((p) => p.id === quote.loan_plan_id)?.plan_code ?? ""}
                  placeholder="e.g. 933"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="application_id">Application ID</Label>
                <Input
                  id="application_id"
                  name="application_id"
                  defaultValue={quote.financing_application_id ?? ""}
                  placeholder="From lender portal"
                />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" variant="outline">Save financing result</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showContractPanel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract</CardTitle>
            <CardDescription>
              {quote.contract_signed_at ? (
                <>
                  <Badge variant="success">Signed</Badge> on {new Date(quote.contract_signed_at).toLocaleString()}
                  {quote.contract_provider && ` via ${quote.contract_provider}`}
                </>
              ) : (
                <>
                  Customer signs the sales contract. v1 is manual (paper or DocuSign outside the app);
                  click below to record the signed date.
                </>
              )}
            </CardDescription>
          </CardHeader>
          {!quote.contract_signed_at && (
            <CardContent>
              <form action={async () => {
                "use server";
                await recordContractSigned(id, "manual");
              }}>
                <Button type="submit">
                  <FileSignature className="h-4 w-4" /> Mark contract signed
                </Button>
              </form>
            </CardContent>
          )}
          {quote.contract_signed_at && quote.status !== "accepted" && (
            <CardContent>
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Ready to accept the quote and create the job (use the Accept button at the top).
              </p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
