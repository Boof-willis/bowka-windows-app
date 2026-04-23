import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: photo } = await supabase.from("job_photos").select("file_path").eq("id", id).single();
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed } = await supabase.storage.from("job-photos").createSignedUrl(photo.file_path, 60);
  if (!signed) return NextResponse.json({ error: "could not sign" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
