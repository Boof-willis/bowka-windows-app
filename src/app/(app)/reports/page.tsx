import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatSqft, windowSqft } from "@/lib/format";
import { tagLabel, windowTags } from "@/lib/tags";
import type { Window } from "@/types/db";

interface Agg {
  count: number;
  total_cost: number;
  total_sqft: number;
}

function avg(a: Agg): number {
  return a.count > 0 ? a.total_cost / a.count : 0;
}

function avgSqft(a: Agg): number {
  return a.total_sqft > 0 ? a.total_cost / a.total_sqft : 0;
}

export default async function ReportsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: windows } = await supabase
    .from("windows")
    .select("*")
    .not("actual_cost_cents", "is", null);

  const rows = (windows ?? []) as Window[];

  const overall: Agg = { count: 0, total_cost: 0, total_sqft: 0 };
  const byType: Record<string, Agg> = {};
  const byTag: Record<string, Agg> = {};

  for (const w of rows) {
    const cost = w.actual_cost_cents ?? 0;
    const sqft = windowSqft(w.width_inches, w.height_inches);
    overall.count++;
    overall.total_cost += cost;
    overall.total_sqft += sqft;

    byType[w.window_type] ??= { count: 0, total_cost: 0, total_sqft: 0 };
    byType[w.window_type].count++;
    byType[w.window_type].total_cost += cost;
    byType[w.window_type].total_sqft += sqft;

    for (const t of windowTags(w)) {
      byTag[t] ??= { count: 0, total_cost: 0, total_sqft: 0 };
      byTag[t].count++;
      byTag[t].total_cost += cost;
      byTag[t].total_sqft += sqft;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Rolling averages across all windows with extracted manufacturer costs.
        </p>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No actual costs yet. Upload a manufacturer invoice on a job to populate this report.
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardDescription>Windows tracked</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{overall.count}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Avg cost / window</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatMoney(avg(overall))}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Avg cost / sqft</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatMoney(avgSqft(overall))}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By window type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Total sqft</TableHead>
                    <TableHead className="text-right">Avg / window</TableHead>
                    <TableHead className="text-right">Avg / sqft</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(byType)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([type, agg]) => (
                      <TableRow key={type}>
                        <TableCell><Badge variant="outline">{tagLabel(`type:${type}`)}</Badge></TableCell>
                        <TableCell className="text-right">{agg.count}</TableCell>
                        <TableCell className="text-right">{formatSqft(agg.total_sqft)}</TableCell>
                        <TableCell className="text-right">{formatMoney(avg(agg))}</TableCell>
                        <TableCell className="text-right">{formatMoney(avgSqft(agg))}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By tag</CardTitle>
              <CardDescription>Drill into specific spec combinations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg / window</TableHead>
                    <TableHead className="text-right">Avg / sqft</TableHead>
                    <TableHead className="text-right">Δ vs overall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(byTag)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([tag, agg]) => {
                      const overallAvg = avg(overall);
                      const diff = overallAvg ? ((avg(agg) - overallAvg) / overallAvg) * 100 : 0;
                      return (
                        <TableRow key={tag}>
                          <TableCell><Badge variant="secondary">{tagLabel(tag)}</Badge></TableCell>
                          <TableCell className="text-right">{agg.count}</TableCell>
                          <TableCell className="text-right">{formatMoney(avg(agg))}</TableCell>
                          <TableCell className="text-right">{formatMoney(avgSqft(agg))}</TableCell>
                          <TableCell className={"text-right " + (diff > 0 ? "text-amber-700" : diff < 0 ? "text-emerald-700" : "")}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
