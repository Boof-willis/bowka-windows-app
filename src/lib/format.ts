export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatMoneyCompact(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return formatMoney(cents);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatSqft(sqft: number): string {
  return `${sqft.toFixed(2)} sqft`;
}

export function formatInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches - feet * 12;
  return `${feet}'${rem.toFixed(0)}"`;
}

export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const dollars = parseFloat(cleaned);
  if (Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

export function windowSqft(widthIn: number, heightIn: number): number {
  return (widthIn * heightIn) / 144;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
