import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await requireRole("admin");

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const jobId = form.get("job_id") as string | null;
  if (!file || !jobId) {
    return NextResponse.json({ error: "file and job_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${jobId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("manufacturer-invoices")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: inv, error: insertError } = await supabase
    .from("manufacturer_invoices")
    .insert({
      job_id: jobId,
      file_path: path,
      file_mime: file.type,
      extraction_status: "pending",
      total_cents: 0,
    })
    .select("id")
    .single();
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ invoice_id: inv.id });
}
