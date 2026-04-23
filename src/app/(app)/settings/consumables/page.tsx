import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

async function updateRate(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const cents = Math.round(parseFloat(String(formData.get("cost"))) * 100);
  const supabase = await createClient();
  await supabase.from("consumable_rates").update({ cost_per_unit_cents: cents }).eq("id", id);
  revalidatePath("/settings/consumables");
}

export default async function ConsumablesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rates } = await supabase.from("consumable_rates").select("*").order("display_name");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Consumable rates</CardTitle>
          <CardDescription>Allocated per window (or per job, where noted). Update as real data comes in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Cost</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">per {r.unit}</TableCell>
                  <TableCell>
                    <form action={updateRate} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Label className="sr-only" htmlFor={`cost-${r.id}`}>Cost</Label>
                      <Input
                        id={`cost-${r.id}`}
                        name="cost"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(r.cost_per_unit_cents / 100).toFixed(2)}
                        className="w-28"
                      />
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatMoney(r.cost_per_unit_cents)}
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
