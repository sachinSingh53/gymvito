import { compareDateOnly, parseDateOnly, type DateOnly } from '@/domain/dates/date-rules';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank-transfer' | 'cheque' | 'other';
export type InvoiceStatus = 'unpaid' | 'partially-paid' | 'paid';
export type DueStatus = 'not-due' | 'due' | 'overdue' | 'paid';

export type InvoiceAmounts = Readonly<{
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}>;

export function requireMinorUnits(value: number, field = 'amount'): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

export function calculateInvoiceAmounts(input: {
  priceMinor: number;
  admissionFeeMinor: number;
  discountMinor: number;
  taxMinor: number;
}): InvoiceAmounts {
  const priceMinor = requireMinorUnits(input.priceMinor, 'price');
  const admissionFeeMinor = requireMinorUnits(input.admissionFeeMinor, 'admission_fee');
  const subtotalMinor = priceMinor + admissionFeeMinor;
  if (!Number.isSafeInteger(subtotalMinor)) throw new Error('MONEY_OVERFLOW');
  const discountMinor = requireMinorUnits(input.discountMinor, 'discount');
  if (discountMinor > subtotalMinor) throw new Error('DISCOUNT_EXCEEDS_SUBTOTAL');
  const taxMinor = requireMinorUnits(input.taxMinor, 'tax');
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new Error('MONEY_OVERFLOW');
  return { subtotalMinor, discountMinor, taxMinor, totalMinor };
}

export function invoiceBalanceMinor(
  totalMinor: number,
  paidMinor: number,
  adjustmentMinor = 0,
): number {
  requireMinorUnits(totalMinor, 'total');
  requireMinorUnits(paidMinor, 'paid');
  if (!Number.isSafeInteger(adjustmentMinor)) throw new Error('INVALID_ADJUSTMENT');
  return Math.max(0, totalMinor - paidMinor - adjustmentMinor);
}

export function deriveInvoiceStatus(totalMinor: number, balanceMinor: number): InvoiceStatus {
  requireMinorUnits(totalMinor, 'total');
  requireMinorUnits(balanceMinor, 'balance');
  if (balanceMinor === 0) return 'paid';
  if (balanceMinor < totalMinor) return 'partially-paid';
  return 'unpaid';
}

export function deriveDueStatus(
  balanceMinor: number,
  dueDate: DateOnly | null,
  today: DateOnly,
): DueStatus {
  requireMinorUnits(balanceMinor, 'balance');
  parseDateOnly(today);
  if (balanceMinor === 0) return 'paid';
  if (!dueDate) return 'due';
  parseDateOnly(dueDate);
  return compareDateOnly(today, dueDate) > 0 ? 'overdue' : 'not-due';
}

export function validateRecordedPayment(amountMinor: number, outstandingMinor: number): void {
  requireMinorUnits(amountMinor, 'payment');
  requireMinorUnits(outstandingMinor, 'outstanding');
  if (amountMinor === 0) throw new Error('PAYMENT_AMOUNT_REQUIRED');
  if (amountMinor > outstandingMinor) throw new Error('PAYMENT_EXCEEDS_OUTSTANDING');
}

export function formatSequence(prefix: string, value: number, width = 6): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('INVALID_SEQUENCE_VALUE');
  const cleanPrefix = prefix
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();
  if (!cleanPrefix) throw new Error('INVALID_SEQUENCE_PREFIX');
  return `${cleanPrefix}-${String(value).padStart(width, '0')}`;
}
