import type { ConsumableRate } from "@/types/db";

export interface AllocatedConsumables {
  total_cents: number;
  breakdown: Array<{ key: string; display_name: string; cost_cents: number }>;
}

export function allocateConsumables(
  rates: ConsumableRate[],
  windowCount: number,
): AllocatedConsumables {
  const breakdown = rates
    .filter((r) => r.active)
    .map((r) => {
      const units = r.unit === "window" ? windowCount : 1;
      return {
        key: r.key,
        display_name: r.display_name,
        cost_cents: r.cost_per_unit_cents * units,
      };
    });
  const total_cents = breakdown.reduce((s, b) => s + b.cost_cents, 0);
  return { total_cents, breakdown };
}
