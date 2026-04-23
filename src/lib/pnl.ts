import type { BurdenRate, ConsumableRate, Job, LaborPayout, Lender, LoanPlan, Quote, Window } from "@/types/db";
import { allocateConsumables } from "./consumables";
import { calcFinancingDeduction } from "./financing";

export interface JobPnL {
  // Top line
  contract_total_cents: number;
  down_payment_cents: number;

  // Financing deductions
  merchant_fee_cents: number;
  activation_fee_cents: number;
  net_revenue_cents: number;

  // Material costs
  material_cost_cents: number; // sum of windows.actual_cost (or quoted fallback)
  material_cost_source: "actual" | "quoted" | "mixed";

  // Consumables (allocated + any job-specific overrides)
  consumables_allocated_cents: number;
  consumables_overrides_cents: number;
  consumables_total_cents: number;

  // Labor
  labor_payout_cents: number;
  labor_burden_cents: number;
  labor_total_cents: number;
  burden_breakdown: Array<{ key: string; display_name: string; cents: number }>;

  // Dump fees (allocated pro-rata from trips assigned to this job)
  dump_cents: number;

  // Totals
  total_cost_cents: number;
  gross_profit_cents: number;
  margin_pct: number;
}

export interface JobPnLInputs {
  quote: Quote;
  job: Job;
  windows: Window[];
  consumableRates: ConsumableRate[];
  burdenRates: BurdenRate[];
  laborPayouts: LaborPayout[];
  loanPlan: LoanPlan | null;
  lender: Lender | null;
  consumableOverridesCents: number;
  dumpAllocatedCents: number;
}

export function calcJobPnL(input: JobPnLInputs): JobPnL {
  const {
    quote,
    job,
    windows,
    consumableRates,
    burdenRates,
    laborPayouts,
    loanPlan,
    lender,
    consumableOverridesCents,
    dumpAllocatedCents,
  } = input;

  const contract_total_cents = quote.total_cents;
  const down_payment_cents = quote.down_payment_cents ?? 0;

  const { merchantFeeCents, activationFeeCents, netAfterFinancingCents } =
    calcFinancingDeduction(
      contract_total_cents,
      quote.payment_method === "finance" ? loanPlan : null,
      lender,
    );

  // Material cost: prefer actual_cost_cents, fall back to quoted_price_cents
  let anyActual = false;
  let anyQuoted = false;
  const material_cost_cents = windows.reduce((sum, w) => {
    if (w.actual_cost_cents != null) {
      anyActual = true;
      return sum + w.actual_cost_cents;
    }
    anyQuoted = true;
    return sum + w.quoted_price_cents;
  }, 0);
  const material_cost_source: JobPnL["material_cost_source"] =
    anyActual && anyQuoted ? "mixed" : anyActual ? "actual" : "quoted";

  // Consumables: rates allocation + any job-specific overrides recorded
  const { total_cents: consumables_allocated_cents } = allocateConsumables(
    consumableRates,
    windows.length,
  );
  const consumables_total_cents = consumables_allocated_cents + consumableOverridesCents;

  // Labor: sum payouts; burden applies per burden_rate config
  const labor_payout_cents = laborPayouts.reduce((s, p) => s + p.payout_cents, 0);
  const burden_breakdown = burdenRates
    .filter((r) => r.active)
    .map((r) => ({
      key: r.key,
      display_name: r.display_name,
      cents: Math.round((labor_payout_cents * r.rate_bps) / 10000),
    }));
  const labor_burden_cents = burden_breakdown.reduce((s, b) => s + b.cents, 0);
  const labor_total_cents = labor_payout_cents + labor_burden_cents;

  const total_cost_cents =
    material_cost_cents + consumables_total_cents + labor_total_cents + dumpAllocatedCents;
  const gross_profit_cents = netAfterFinancingCents - total_cost_cents;
  const margin_pct = contract_total_cents > 0
    ? (gross_profit_cents / netAfterFinancingCents) * 100
    : 0;

  return {
    contract_total_cents,
    down_payment_cents,
    merchant_fee_cents: merchantFeeCents,
    activation_fee_cents: activationFeeCents,
    net_revenue_cents: netAfterFinancingCents,
    material_cost_cents,
    material_cost_source,
    consumables_allocated_cents,
    consumables_overrides_cents: consumableOverridesCents,
    consumables_total_cents,
    labor_payout_cents,
    labor_burden_cents,
    labor_total_cents,
    burden_breakdown,
    dump_cents: dumpAllocatedCents,
    total_cost_cents,
    gross_profit_cents,
    margin_pct,
  };
}
