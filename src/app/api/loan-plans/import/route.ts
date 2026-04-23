import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Papa from "papaparse";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are extracting loan-plan data from a lender rate sheet.
Return STRICT JSON only:
{
  "plans": [
    {
      "plan_code": string (e.g. "930"),
      "promotional_offer": string,
      "monthly_payment_factor": number | null (decimal, e.g. 0.025 for 2.5%),
      "est_num_payments": integer | null,
      "merchant_fee_bps": integer (basis points, e.g. 1360 for 13.60%),
      "category": "deferred_interest" | "fixed_payment" | "equal_monthly" | null
    }
  ]
}`;

interface ExtractedPlan {
  plan_code: string;
  promotional_offer: string;
  monthly_payment_factor: number | null;
  est_num_payments: number | null;
  merchant_fee_bps: number;
  category: string | null;
}

export async function POST(req: Request) {
  await requireRole("admin");
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const lenderName = String(form.get("lender_name") ?? "").trim();
  if (!file || !lenderName) return NextResponse.json({ error: "file and lender_name required" }, { status: 400 });

  const supabase = await createClient();
  const service = createServiceClient();

  // Ensure lender exists
  const { data: existing } = await supabase.from("lenders").select("*").eq("name", lenderName).maybeSingle();
  let lenderId = existing?.id;
  if (!lenderId) {
    const { data: created, error } = await service
      .from("lenders")
      .insert({ name: lenderName })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lenderId = created.id;
  }

  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isCsv = file.type.includes("csv") || file.name.endsWith(".csv");

  let plans: ExtractedPlan[] = [];

  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    plans = parsed.data
      .filter((row) => row.plan_code || row.Plan || row.plan)
      .map((row) => {
        const fee = parseFloat(row.merchant_fee ?? row["Merchant Fee"] ?? row.merchant_fee_bps ?? "0");
        return {
          plan_code: row.plan_code ?? row.Plan ?? row.plan ?? "",
          promotional_offer: row.promotional_offer ?? row["Promotional Offer"] ?? "",
          monthly_payment_factor: row.monthly_payment_factor ? parseFloat(row.monthly_payment_factor) : null,
          est_num_payments: row.est_num_payments ? parseInt(row.est_num_payments) : null,
          merchant_fee_bps: Math.round(fee < 1 ? fee * 10000 : fee * 100),
          category: row.category ?? null,
        };
      });
  } else if (isPdf) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const buf = Buffer.from(await file.arrayBuffer()).toString("base64");
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf } },
            { type: "text", text: "Extract all loan plans from this rate sheet. Return JSON only." },
          ],
        },
      ],
    });
    const textBlock = msg.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") return NextResponse.json({ error: "no extraction" }, { status: 500 });
    const raw = textBlock.text.trim().replace(/^```json\s*/, "").replace(/```$/, "");
    const parsed = JSON.parse(raw) as { plans: ExtractedPlan[] };
    plans = parsed.plans ?? [];
  } else {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  // Upsert
  let imported = 0;
  for (const p of plans) {
    if (!p.plan_code) continue;
    const { error } = await service.from("loan_plans").upsert(
      {
        lender_id: lenderId,
        plan_code: p.plan_code,
        promotional_offer: p.promotional_offer,
        monthly_payment_factor: p.monthly_payment_factor,
        est_num_payments: p.est_num_payments,
        merchant_fee_bps: p.merchant_fee_bps,
        category: p.category,
        active: true,
      },
      { onConflict: "lender_id,plan_code" },
    );
    if (!error) imported++;
  }

  return NextResponse.json({ imported, total: plans.length });
}
