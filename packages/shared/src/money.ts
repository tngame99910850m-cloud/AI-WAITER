import { z } from 'zod';

/**
 * All monetary values in the platform are represented as an integer number of
 * minor units (e.g. dirhams/fils, cents) together with an ISO-4217 currency
 * code. Never use floating point for money.
 */
export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO-4217 code');

export const moneySchema = z.object({
  /** Integer amount in the currency's minor unit (e.g. 2200 = 22.00 QAR). */
  amount: z.number().int(),
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;

export function money(amount: number, currency = 'QAR'): Money {
  return { amount: Math.round(amount), currency };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function multiplyMoney(a: Money, factor: number): Money {
  return { amount: Math.round(a.amount * factor), currency: a.currency };
}

export function sumMoney(items: Money[], currency: string): Money {
  return items.reduce<Money>(
    (acc, m) => addMoney(acc, m),
    { amount: 0, currency },
  );
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

/** Human-readable string, e.g. `22.00 QAR`. Presentation only. */
export function formatMoney(m: Money, fractionDigits = 2): string {
  const value = (m.amount / 10 ** fractionDigits).toFixed(fractionDigits);
  return `${value} ${m.currency}`;
}
