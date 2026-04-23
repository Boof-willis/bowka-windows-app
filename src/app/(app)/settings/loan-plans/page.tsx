import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBps, formatMoney } from "@/lib/format";
import { LoanSheetImport } from "./import-form";

export default async function LoanPlansPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: lenders } = await supabase.from("lenders").select("*").order("name");
  const { data: plans } = await supabase.from("loan_plans").select("*, lender:lenders(name)").order("lender_id").order("plan_code");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Lenders</CardTitle>
          <CardDescription>Financing partners and their per-account fees.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(lenders ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{l.name}</div>
                {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
              </div>
              <div className="text-right text-sm">
                <div>Activation: {formatMoney(l.activation_fee_cents)}</div>
                <div className="text-muted-foreground">
                  Min vol: {formatMoney(l.min_monthly_volume_cents)} / mo
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import rate sheet</CardTitle>
          <CardDescription>
            Upload a CSV or PDF rate sheet — Claude will extract plan codes + merchant fees and merge into the table below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoanSheetImport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan plans</CardTitle>
          <CardDescription>{(plans ?? []).length} active plans across all lenders.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Payment factor</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead className="text-right">Merchant fee</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((p) => (
                <TableRow key={p.id}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <TableCell>{(p.lender as any)?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.plan_code}</TableCell>
                  <TableCell>{p.promotional_offer}</TableCell>
                  <TableCell>{p.monthly_payment_factor ? `${(p.monthly_payment_factor * 100).toFixed(2)}%` : "—"}</TableCell>
                  <TableCell>{p.est_num_payments ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatBps(p.merchant_fee_bps)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{p.category?.replace("_", " ") ?? "—"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
