import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

export default async function JobsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select(`
      id, job_number, status, scheduled_install_date, assigned_installer_id,
      quote:quotes(total_cents, lead:leads(customer_name, city))
    `)
    .order("created_at", { ascending: false });

  if (profile.role === "installer") {
    query = query.eq("assigned_installer_id", profile.id);
  }

  const { data: jobs } = await query;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role === "installer" ? "Your assigned jobs." : "All active jobs."}
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Install date</TableHead>
              <TableHead className="text-right">Contract</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(jobs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No jobs yet.
                </TableCell>
              </TableRow>
            )}
            {(jobs ?? []).map((j) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const q = j.quote as any;
              return (
                <TableRow key={j.id}>
                  <TableCell>
                    <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">
                      {j.job_number ?? j.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{q?.lead?.customer_name ?? "—"}</TableCell>
                  <TableCell>{q?.lead?.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{j.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>{j.scheduled_install_date ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(q?.total_cents ?? 0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
