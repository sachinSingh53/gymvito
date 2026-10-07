export const PLAN_DURATION_UNITS = ['day', 'week', 'month', 'year'] as const;
export type PlanDurationUnit = (typeof PLAN_DURATION_UNITS)[number];
export type RenewalBehavior = 'immediate' | 'after-expiry' | 'ask';
export type DiscountType = 'none' | 'fixed' | 'percentage';

export type PlanInput = Readonly<{
  name: string;
  description: string;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  priceMinor: number;
  admissionFeeMinor: number;
  currencyCode: string;
  taxLabel: string;
  taxRateBasisPoints: number;
  discountType: DiscountType;
  discountValue: number;
  colorHex: string;
  freezeAllowed: boolean;
  maxFreezeDays: number | null;
  freezeExtendsEndDate: boolean;
  renewalBehavior: RenewalBehavior;
}>;

export function validatePlan(input: PlanInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = 'required';
  if (!Number.isSafeInteger(input.durationValue) || input.durationValue < 1) {
    errors.durationValue = 'invalid';
  }
  if (!PLAN_DURATION_UNITS.includes(input.durationUnit)) errors.durationUnit = 'invalid';
  if (!Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0)
    errors.priceMinor = 'invalid';
  if (!Number.isSafeInteger(input.admissionFeeMinor) || input.admissionFeeMinor < 0) {
    errors.admissionFeeMinor = 'invalid';
  }
  if (!/^[A-Z]{3}$/.test(input.currencyCode)) errors.currencyCode = 'invalid';
  if (
    !Number.isSafeInteger(input.taxRateBasisPoints) ||
    input.taxRateBasisPoints < 0 ||
    input.taxRateBasisPoints > 10_000
  ) {
    errors.taxRateBasisPoints = 'invalid';
  }
  if (!Number.isSafeInteger(input.discountValue) || input.discountValue < 0) {
    errors.discountValue = 'invalid';
  }
  if (input.discountType === 'percentage' && input.discountValue > 10_000) {
    errors.discountValue = 'invalid';
  }
  if (!/^#[0-9A-F]{6}$/i.test(input.colorHex)) errors.colorHex = 'invalid';
  if (
    input.freezeAllowed &&
    (input.maxFreezeDays === null ||
      !Number.isSafeInteger(input.maxFreezeDays) ||
      input.maxFreezeDays < 1)
  ) {
    errors.maxFreezeDays = 'invalid';
  }
  return errors;
}

export function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/[₹,\s]/g, '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMoneyInput(minor: number): string {
  return (minor / 100).toFixed(2);
}
