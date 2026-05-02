import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canSeeCosts } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { calcJobPnL } from "@/lib/pnl";
import type { BurdenRate, ConsumableRate, LaborPayout, Lender, LoanPlan, Quote, Window, Job } from "@/types/db";
import { addLaborPayout, addConsumableOverride, addDumpTrip, markManufacturerOrderSent } from "../actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, FileDown } from "lucide-react";
import { InvoiceUpload } from "./invoice-upload";
import { PhotoUploader } from "./photo-uploader";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();
  const typedJob = job as Job;

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", typedJob.quote_id).single();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", quote?.lead_id ?? "").single();
  const { data: windows } = await supabase.from("windows").select("*").eq("quote_id", typedJob.quote_id).order("position");
  const { data: invoices } = await supabase.from("manufacturer_invoices").select("*").eq("job_id", id).order("created_at", { ascending: false });
  const { data: photos } = await supabase.from("job_photos").select("*").eq("job_id", id).order("created_at", { ascending: false });
  const { data: manufacturers } = await supabase.from("manufacturers").select("*").eq("active", true).order("name");
  const { data: payouts } = await supabase.from("labor_payouts").select("*").eq("job_id", id).order("created_at", { ascending: false });
  const { data: overrides } = await supabase.from("job_consumables").select("*").eq("job_id", id);
  const { data: dumpJoin } = await supabase
    .from("dump_trip_jobs")
    .select("windows_from_job, dump_trip:dump_trips(id, trip_date, fee_cents, weight_tonnes, windows_hauled)")
    .eq("job_id", id);

  const showCosts = canSeeCosts(profile.role);

  let pnl: ReturnType<typeof calcJobPnL> | null = null;
  if (showCosts && quote && windows) {
    const [{ data: consumables }, { data: burdens }, { data: plan }, { data: lender }] = await Promise.all([
      supabase.from("consumable_rates").select("*").eq("active", true),
      supabase.from("burden_rates").select("*").eq("active", true),
      quote.loan_plan_id
        ? supabase.from("loan_plans").select("*").eq("id", quote.loan_plan_id).single()
        : Promise.resolve({ data: null }),
      quote.loan_plan_id
        ? supabase.from("lenders").select("*")
            .eq("id", (await supabase.from("loan_plans").select("lender_id").eq("id", quote.loan_plan_id).single()).data?.lender_id ?? "")
            .single()
        : Promise.resolve({ data: null }),
    ]);

    const consumableOverrides = (overrides ?? []).reduce((s, o) => s + (o.total_cost_cents ?? 0), 0);
    // Pro-rata dump: fee_cents * (windows_from_job / windows_hauled)
    const dumpAllocated = (dumpJoin ?? []).reduce((s, row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trip = row.dump_trip as any;
      if (!trip) return s;
      const hauled = trip.windows_hauled ?? row.windows_from_job;
      if (!hauled) return s + trip.fee_cents;
      return s + Math.round((trip.fee_cents * row.windows_from_job) / hauled);
    }, 0);

    pnl = calcJobPnL({
      quote: quote as Quote,
      job: typedJob,
      windows: windows as Window[],
      consumableRates: (consumables ?? []) as ConsumableRate[],
      burdenRates: (burdens ?? []) as BurdenRate[],
      laborPayouts: (payouts ?? []) as LaborPayout[],
      loanPlan: (plan ?? null) as LoanPlan | null,
      lender: (lender ?? null) as Lender | null,
      consumableOverridesCents: consumableOverrides,
      dumpAllocatedCents: dumpAllocated,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to jobs
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {typedJob.job_number ?? id.slice(0, 8)} · {lead?.customer_name ?? "—"}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="capitalize">{typedJob.status.replace("_", " ")}</Badge>
            {typedJob.scheduled_install_date && <span>· Install {typedJob.scheduled_install_date}</span>}
          </div>
        </div>
      </div>

      {showCosts && pnl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job P&L</CardTitle>
            <CardDescription>
              Material from {pnl.material_cost_source === "actual" ? "manufacturer invoice" : pnl.material_cost_source === "mixed" ? "mixed (some actual, some quoted)" : "quoted prices (invoice not yet uploaded)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <PnLRow label="Contract total" value={formatMoney(pnl.contract_total_cents)} />
                <PnLRow label="— Merchant fee" value={`− ${formatMoney(pnl.merchant_fee_cents)}`} dim />
                <PnLRow label="= Net revenue" value={formatMoney(pnl.net_revenue_cents)} strong />
              </div>
              <div className="space-y-1 text-sm">
                <PnLRow label="Materials" value={`− ${formatMoney(pnl.material_cost_cents)}`} dim />
                <PnLRow label="Consumables" value={`− ${formatMoney(pnl.consumables_total_cents)}`} dim />
                <PnLRow label="Labor (payout + burden)" value={`− ${formatMoney(pnl.labor_total_cents)}`} dim />
                <PnLRow label="Dump fees" value={`− ${formatMoney(pnl.dump_cents)}`} dim />
                <PnLRow label="= Gross profit" value={formatMoney(pnl.gross_profit_cents)} strong />
                <PnLRow label="Margin" value={`${pnl.margin_pct.toFixed(1)}%`} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manufacturer order */}
      {showCosts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manufacturer order</CardTitle>
            <CardDescription>
              {typedJob.manufacturer_order_sent_at ? (
                <>
                  Sent {new Date(typedJob.manufacturer_order_sent_at).toLocaleString()}
                  {typedJob.manufacturer_name && ` to ${typedJob.manufacturer_name}`}
                  {typedJob.manufacturer_order_number && ` · Order #${typedJob.manufacturer_order_number}`}
                </>
              ) : (
                <>Download the order PDF, send to your supplier, then mark as sent.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <Button variant="outline" asChild size="sm">
                <a href={`/api/quotes/${typedJob.quote_id}/order-form`} target="_blank" rel="noreferrer">
                  <FileDown className="h-4 w-4" /> Download order PDF
                </a>
              </Button>
            </div>
            <form action={markManufacturerOrderSent.bind(null, id)} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer_id">Manufacturer</Label>
                <Select name="manufacturer_id" defaultValue={typedJob.manufacturer_id ?? ""}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(manufacturers ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sent_to">Sent to (email)</Label>
                <Input
                  id="sent_to"
                  name="sent_to"
                  type="email"
                  defaultValue={typedJob.manufacturer_order_sent_to ?? (manufacturers?.[0]?.order_email ?? "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order_number">Order # (theirs)</Label>
                <Input
                  id="order_number"
                  name="order_number"
                  defaultValue={typedJob.manufacturer_order_number ?? ""}
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit">
                  <Send className="h-4 w-4" /> Mark as sent
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manufacturer invoice</CardTitle>
            <CardDescription>Upload to extract per-window costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InvoiceUpload jobId={id} />
            {(invoices ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">{inv.manufacturer_name ?? "Invoice"} {inv.invoice_number ? `#${inv.invoice_number}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.invoice_date ?? new Date(inv.created_at).toLocaleDateString()} · {inv.extraction_status}
                  </div>
                </div>
                <div className="text-right">{formatMoney(inv.total_cents)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Before / After photos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PhotoUploader jobId={id} />
            <div className="grid grid-cols-3 gap-2">
              {(photos ?? []).map((p) => (
                <div key={p.id} className="aspect-square overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={p.caption ?? p.phase} src={`/api/photos/${p.id}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {showCosts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labor payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addLaborPayout.bind(null, id)} className="mb-4 flex items-end gap-2">
              <div className="space-y-1.5">
                <Label>Payout ($)</Label>
                <Input name="payout" type="number" step="0.01" min="0" required />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Input name="payout_type" placeholder="install, commission" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Notes</Label>
                <Input name="notes" />
              </div>
              <Button type="submit">Add</Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payouts ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No payouts recorded.</TableCell>
                  </TableRow>
                )}
                {(payouts ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="capitalize">{p.payout_type ?? "—"}</TableCell>
                    <TableCell>{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.payout_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dump trips</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addDumpTrip.bind(null, id)} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input name="trip_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fee ($)</Label>
              <Input name="fee" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (t)</Label>
              <Input name="weight" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Windows hauled</Label>
              <Input name="windows_hauled" type="number" min="0" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Log trip</Button>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Windows</TableHead>
                <TableHead>Weight (t)</TableHead>
                <TableHead className="text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dumpJoin ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No dump trips.</TableCell>
                </TableRow>
              )}
              {(dumpJoin ?? []).map((row, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const trip = row.dump_trip as any;
                return (
                  <TableRow key={i}>
                    <TableCell>{trip?.trip_date}</TableCell>
                    <TableCell>{trip?.windows_hauled ?? "—"}</TableCell>
                    <TableCell>{trip?.weight_tonnes ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(trip?.fee_cents ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PnLRow({ label, value, dim, strong }: { label: string; value: string; dim?: boolean; strong?: boolean }) {
  return (
    <div className={"flex justify-between " + (dim ? "text-muted-foreground" : "") + (strong ? " font-semibold border-t pt-1 mt-1" : "")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
