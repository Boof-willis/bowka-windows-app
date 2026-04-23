import Link from "next/link";
import { requireProfile, canSeeCosts } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { ArrowRight, Briefcase, Users } from "lucide-react";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const showCosts = canSeeCosts(profile.role);

  const [{ data: leads }, { data: jobs }] = await Promise.all([
    supabase.from("leads").select("id, customer_name, status, created_at").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("jobs")
      .select("id, job_number, status, scheduled_install_date, actual_material_cost_cents, quote:quotes(total_cents, lead:leads(customer_name))")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Aggregate KPIs (admin only)
  let avgMaterialPerWindow = 0;
  let totalWindows = 0;
  let avgContract = 0;
  if (showCosts) {
    const { data: winAgg } = await supabase
      .from("windows")
      .select("actual_cost_cents")
      .not("actual_cost_cents", "is", null);
    if (winAgg && winAgg.length > 0) {
      const sum = winAgg.reduce((s, w) => s + (w.actual_cost_cents ?? 0), 0);
      totalWindows = winAgg.length;
      avgMaterialPerWindow = sum / winAgg.length;
    }

    const { data: qAgg } = await supabase.from("quotes").select("total_cents").eq("status", "accepted");
    if (qAgg && qAgg.length > 0) {
      avgContract = qAgg.reduce((s, q) => s + q.total_cents, 0) / qAgg.length;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {profile.full_name ?? profile.email.split("@")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {showCosts ? "Company-wide performance snapshot." : "Your active pipeline."}
        </p>
      </div>

      {showCosts && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard title="Avg contract" value={formatMoneyCompact(avgContract)} />
          <KpiCard title="Avg material / window" value={formatMoney(avgMaterialPerWindow)} />
          <KpiCard title="Windows in history" value={totalWindows.toString()} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent leads</CardTitle>
              <CardDescription>Latest 5</CardDescription>
            </div>
            <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {!leads || leads.length === 0 ? (
              <EmptyState icon={Users} label="No leads yet" href="/leads/new" cta="Create lead" />
            ) : (
              leads.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50">
                  <div>
                    <div className="font-medium">{l.customer_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{l.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent jobs</CardTitle>
              <CardDescription>Latest 5</CardDescription>
            </div>
            <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {!jobs || jobs.length === 0 ? (
              <EmptyState icon={Briefcase} label="No jobs yet" />
            ) : (
              jobs.map((j) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const customerName = (j.quote as any)?.lead?.customer_name ?? "—";
                return (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50">
                    <div>
                      <div className="font-medium">{j.job_number ?? "—"} · {customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {j.scheduled_install_date ?? "Not scheduled"}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{j.status.replace("_", " ")}</Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  label,
  href,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6" />
      <div>{label}</div>
      {href && cta && (
        <Link href={href} className="text-primary hover:underline">{cta}</Link>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
