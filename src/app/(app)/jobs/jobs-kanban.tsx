"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Calendar, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { updateJobStatus } from "./actions";
import type { JobStatus } from "@/types/db";

export interface KanbanJob {
  id: string;
  job_number: string | null;
  status: JobStatus;
  scheduled_install_date: string | null;
  contract_total_cents: number;
  customer_name: string;
  city: string | null;
}

const COLUMNS: { id: JobStatus; label: string; tone: string }[] = [
  { id: "pending_order",    label: "Pending order",    tone: "bg-slate-50 border-slate-200" },
  { id: "ordered",          label: "Ordered",          tone: "bg-amber-50 border-amber-200" },
  { id: "in_production",    label: "In production",    tone: "bg-amber-50 border-amber-200" },
  { id: "ready_to_install", label: "Ready to install", tone: "bg-blue-50 border-blue-200" },
  { id: "scheduled",        label: "Scheduled",        tone: "bg-blue-50 border-blue-200" },
  { id: "installed",        label: "Installed",        tone: "bg-emerald-50 border-emerald-200" },
  { id: "completed",        label: "Completed",        tone: "bg-emerald-50 border-emerald-200" },
  { id: "cancelled",        label: "Cancelled",        tone: "bg-rose-50 border-rose-200" },
];

export function JobsKanban({
  jobs: initialJobs,
  canEdit,
}: {
  jobs: KanbanJob[];
  canEdit: boolean;
}) {
  const [jobs, setJobs] = useState<KanbanJob[]>(initialJobs);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const grouped = useMemo(() => groupByStatus(jobs), [jobs]);
  const activeJob = useMemo(() => jobs.find((j) => j.id === activeId) ?? null, [activeId, jobs]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return;
    const jobId = String(e.active.id);
    const newStatus = e.over?.id as JobStatus | undefined;
    if (!newStatus) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;

    // Optimistic update
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
    startTransition(async () => {
      try {
        await updateJobStatus(jobId, newStatus);
      } catch (err) {
        // Revert on failure
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: job.status } : j)));
        console.error("Failed to update job status", err);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column key={col.id} column={col} jobs={grouped[col.id] ?? []} canEdit={canEdit} />
        ))}
      </div>
      <DragOverlay>{activeJob ? <Card job={activeJob} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function groupByStatus(jobs: KanbanJob[]): Record<JobStatus, KanbanJob[]> {
  const out = {} as Record<JobStatus, KanbanJob[]>;
  for (const j of jobs) {
    (out[j.status] ??= []).push(j);
  }
  return out;
}

function Column({
  column,
  jobs,
  canEdit,
}: {
  column: (typeof COLUMNS)[number];
  jobs: KanbanJob[];
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border-2 transition-colors",
        column.tone,
        isOver && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{column.label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-foreground">
          {jobs.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {jobs.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted-foreground/20 p-4 text-center text-xs text-muted-foreground">
            Drop here
          </div>
        ) : (
          jobs.map((job) => <DraggableCard key={job.id} job={job} canEdit={canEdit} />)
        )}
      </div>
    </div>
  );
}

function DraggableCard({ job, canEdit }: { job: KanbanJob; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-30")}
    >
      <Card job={job} />
    </div>
  );
}

function Card({ job, dragging }: { job: KanbanJob; dragging?: boolean }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      onClick={(e) => {
        // Don't navigate while dragging — DnD listeners suppress click but be safe
        if (dragging) e.preventDefault();
      }}
      className={cn(
        "block rounded-md border bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "cursor-grabbing rotate-[1deg] shadow-lg",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="font-medium leading-tight">{job.customer_name}</div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {job.job_number ?? job.id.slice(0, 6)}
        </Badge>
      </div>
      {job.city && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {job.city}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-xs">
        {job.scheduled_install_date ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(job.scheduled_install_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <span className="font-medium">{formatMoneyCompact(job.contract_total_cents)}</span>
      </div>
    </Link>
  );
}
