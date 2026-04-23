import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const profile = await requireProfile();
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const jobId = form.get("job_id") as string | null;
  const phase = String(form.get("phase") ?? "before");

  if (!file || !jobId) return NextResponse.json({ error: "file and job_id required" }, { status: 400 });

  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${jobId}/${phase}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("job-photos")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: insertError } = await supabase.from("job_photos").insert({
    job_id: jobId,
    file_path: path,
    phase,
    uploaded_by: profile.id,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
