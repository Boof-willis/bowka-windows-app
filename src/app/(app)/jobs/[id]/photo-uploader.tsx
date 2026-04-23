"use client";

import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export function PhotoUploader({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"before" | "after" | "during">("before");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  async function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("job_id", jobId);
    fd.append("phase", phase);

    startTransition(async () => {
      const res = await fetch("/api/photos/upload", { method: "POST", body: fd });
      if (res.ok) {
        setFile(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Select value={phase} onValueChange={(v) => setPhase(v as "before" | "after" | "during")}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="before">Before</SelectItem>
          <SelectItem value="during">During</SelectItem>
          <SelectItem value="after">After</SelectItem>
        </SelectContent>
      </Select>
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button onClick={upload} disabled={!file || isPending}>
        <Camera className="h-4 w-4" /> {isPending ? "Uploading…" : "Add"}
      </Button>
    </div>
  );
}
