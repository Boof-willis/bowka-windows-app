"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoanSheetImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [lenderName, setLenderName] = useState("Synchrony");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("lender_name", lenderName);

    startTransition(async () => {
      setStatus("Uploading and extracting…");
      const res = await fetch("/api/loan-plans/import", { method: "POST", body: fd });
      if (!res.ok) {
        setStatus(`Failed: ${await res.text()}`);
        return;
      }
      const json = await res.json();
      setStatus(`Imported ${json.imported} plan(s).`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Lender name</Label>
          <Input value={lenderName} onChange={(e) => setLenderName(e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Rate sheet (PDF or CSV)</Label>
          <Input type="file" accept=".pdf,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={!file || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import
        </Button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}
