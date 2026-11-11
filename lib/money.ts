const exactFormat = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const wholeFormat = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Currency with at most two decimal places, as cents. */
export function toCents(amount: number): number {
  const negative = amount < 0;
  const [dollars, cents = "00"] = Math.abs(amount).toFixed(2).split(".");
  const value = Number(dollars) * 100 + Number(cents);
  return negative ? -value : value;
}

export function portionCents(amount: number, percent: number): number {
  return Math.round((toCents(amount) * percent) / 100);
}

export function wholeDollarsFromCents(cents: number): number {
  if (cents <= 0) return 0;
  return Math.floor(cents / 100);
}

export function formatCents(cents: number): string {
  return exactFormat.format(cents / 100);
}

export function formatMoney(amount: number): string {
  return formatCents(toCents(amount));
}

export function formatWholeDollars(dollars: number): string {
  return wholeFormat.format(dollars);
}

export function formatHours(hours: number): string {
  const tenths = Math.round(hours * 10);
  const whole = Math.trunc(tenths / 10);
  const fraction = Math.abs(tenths % 10);
  return fraction === 0 ? String(whole) : `${whole}.${fraction}`;
}

export function deductionCents(tenthsOfHour: number, centsPerHour: number): number {
  return Math.round((tenthsOfHour * centsPerHour) / 10);
}
