import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { JobsKanban, type KanbanJob } from "./jobs-kanban";
import type { JobStatus } from "@/types/db";

export default async function JobsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select(`
      id, job_number, status, scheduled_install_date,
      quote:quotes(total_cents, lead:leads(customer_name, city))
    `)
    .order("created_at", { ascending: false });

  if (profile.role === "installer") {
    query = query.eq("assigned_installer_id", profile.id);
  }

  const { data: jobs } = await query;

  const kanbanJobs: KanbanJob[] = (jobs ?? []).map((j) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = j.quote as any;
    return {
      id: j.id as string,
      job_number: j.job_number,
      status: j.status as JobStatus,
      scheduled_install_date: j.scheduled_install_date,
      contract_total_cents: q?.total_cents ?? 0,
      customer_name: q?.lead?.customer_name ?? "—",
      city: q?.lead?.city ?? null,
    };
  });

  const canEdit = profile.role === "admin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role === "installer"
            ? "Your assigned jobs."
            : canEdit
              ? "Drag cards between columns to update status."
              : "Pipeline view."}
        </p>
      </div>

      <JobsKanban jobs={kanbanJobs} canEdit={canEdit} />
    </div>
  );
}
