"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InvoiceUpload({ jobId }: { jobId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function upload() {
    if (!file) return;
    setStatus("Uploading…");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("job_id", jobId);

    const res = await fetch("/api/invoices/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const msg = await res.text();
      setStatus(`Upload failed: ${msg}`);
      return;
    }
    const { invoice_id } = await res.json();
    setStatus("Extracting windows…");

    startTransition(async () => {
      const extractRes = await fetch(`/api/invoices/${invoice_id}/extract`, { method: "POST" });
      if (!extractRes.ok) {
        setStatus(`Extraction failed: ${await extractRes.text()}`);
        return;
      }
      setStatus("Done — page will refresh");
      setTimeout(() => window.location.reload(), 800);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={upload} disabled={!file || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </Button>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
