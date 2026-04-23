import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus } from "lucide-react";

export default async function LeadsPage() {
  await requireRole("admin", "sales_rep");
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, customer_name, city, phone, status, source, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">All leads assigned to you.</p>
        </div>
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="h-4 w-4" /> New lead
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leads ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No leads yet. <Link href="/leads/new" className="text-primary hover:underline">Create one</Link>.
                </TableCell>
              </TableRow>
            )}
            {(leads ?? []).map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => {}}>
                <TableCell>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.customer_name}
                  </Link>
                </TableCell>
                <TableCell>{l.city ?? "—"}</TableCell>
                <TableCell>{l.phone ?? "—"}</TableCell>
                <TableCell>{l.source ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{l.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
