import {
  calculateInvoiceAmounts,
  deriveDueStatus,
  deriveInvoiceStatus,
  formatSequence,
  invoiceBalanceMinor,
  validateRecordedPayment,
} from './money';

describe('billing money rules', () => {
  it('uses integer minor units for discounts, tax, totals, and balances', () => {
    expect(
      calculateInvoiceAmounts({
        priceMinor: 100_001,
        admissionFeeMinor: 9_999,
        discountMinor: 10_000,
        taxMinor: 18_000,
      }),
    ).toEqual({
      subtotalMinor: 110_000,
      discountMinor: 10_000,
      taxMinor: 18_000,
      totalMinor: 118_000,
    });
    expect(invoiceBalanceMinor(118_000, 50_000)).toBe(68_000);
    expect(deriveInvoiceStatus(118_000, 68_000)).toBe('partially-paid');
    expect(deriveInvoiceStatus(118_000, 0)).toBe('paid');
  });

  it('rejects zero, fractional, negative, and overpayment amounts', () => {
    expect(() => validateRecordedPayment(0, 100)).toThrow('PAYMENT_AMOUNT_REQUIRED');
    expect(() => validateRecordedPayment(101, 100)).toThrow('PAYMENT_EXCEEDS_OUTSTANDING');
    expect(() => validateRecordedPayment(1.5, 100)).toThrow('INVALID_PAYMENT');
    expect(() =>
      calculateInvoiceAmounts({
        priceMinor: -1,
        admissionFeeMinor: 0,
        discountMinor: 0,
        taxMinor: 0,
      }),
    ).toThrow('INVALID_PRICE');
  });

  it('derives overdue at device-local date boundaries without timestamps', () => {
    expect(deriveDueStatus(500, '2026-10-08', '2026-10-08')).toBe('not-due');
    expect(deriveDueStatus(500, '2026-10-08', '2026-10-09')).toBe('overdue');
    expect(deriveDueStatus(0, '2026-10-08', '2026-10-09')).toBe('paid');
  });

  it('formats stable prefixed sequences', () => {
    expect(formatSequence(' inv ', 42)).toBe('INV-000042');
    expect(formatSequence('REC', 1)).toBe('REC-000001');
  });
});
