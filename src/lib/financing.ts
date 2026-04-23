import type { Lender, LoanPlan } from "@/types/db";

export interface FinancingDeduction {
  merchantFeeCents: number;
  activationFeeCents: number;
  netAfterFinancingCents: number;
}

/**
 * Given a contract total (in cents), a selected loan plan, and the lender,
 * compute how much the dealer (Bowka) actually receives after the merchant fee.
 *
 * netAfterFinancing = contractTotal * (1 - merchant_fee_bps/10000)
 * activation fee ($69 Synchrony) is charged to the customer, NOT deducted from us.
 * We still surface it in the return shape so admin can see the full picture.
 */
export function calcFinancingDeduction(
  contractTotalCents: number,
  plan: LoanPlan | null,
  lender: Lender | null,
  isCustomerFirstPurchase = true,
): FinancingDeduction {
  if (!plan) {
    return {
      merchantFeeCents: 0,
      activationFeeCents: 0,
      netAfterFinancingCents: contractTotalCents,
    };
  }
  const merchantFeeCents = Math.round((contractTotalCents * plan.merchant_fee_bps) / 10000);
  const activationFeeCents = isCustomerFirstPurchase ? (lender?.activation_fee_cents ?? 0) : 0;
  return {
    merchantFeeCents,
    activationFeeCents,
    netAfterFinancingCents: contractTotalCents - merchantFeeCents,
  };
}
