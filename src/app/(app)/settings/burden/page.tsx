import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function updateBurden(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const bps = Math.round(parseFloat(String(formData.get("rate"))) * 100);
  const supabase = await createClient();
  await supabase.from("burden_rates").update({ rate_bps: bps }).eq("id", id);
  revalidatePath("/settings/burden");
}

export default async function BurdenPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rates } = await supabase.from("burden_rates").select("*").order("display_name");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Labor burden rates</CardTitle>
          <CardDescription>
            Applied as a % of labor payouts in every job P&L. <strong>Verify these with your payroll provider and UT DWS rate notice before go-live.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Rate (%)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rates ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.display_name}</div>
                    {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.applies_to}</TableCell>
                  <TableCell>
                    <form action={updateBurden} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Input
                        name="rate"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(r.rate_bps / 100).toFixed(2)}
                        className="w-24"
                      />
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
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
