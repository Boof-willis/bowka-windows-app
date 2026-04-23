import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canSeeCosts } from "@/lib/auth";
import { QuoteBuilder } from "./quote-builder";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: windows }, { data: lead }, { data: loanPlans }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("windows").select("*").eq("quote_id", id).order("position"),
    supabase.from("leads").select("*").eq("id", (await supabase.from("quotes").select("lead_id").eq("id", id).single()).data?.lead_id ?? "").single(),
    supabase.from("loan_plans").select("*, lender:lenders(name)").eq("active", true).order("plan_code"),
  ]);

  if (!quote) notFound();

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
    </div>
  );
}
