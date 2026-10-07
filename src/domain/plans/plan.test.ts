import { formatMoneyInput, parseMoneyInput, validatePlan, type PlanInput } from './plan';

const valid: PlanInput = {
  name: 'Annual Strength',
  description: '',
  durationValue: 1,
  durationUnit: 'year',
  priceMinor: 18_000_00,
  admissionFeeMinor: 500_00,
  currencyCode: 'INR',
  taxLabel: 'GST',
  taxRateBasisPoints: 1800,
  discountType: 'percentage',
  discountValue: 1000,
  colorHex: '#0D6659',
  freezeAllowed: true,
  maxFreezeDays: 30,
  freezeExtendsEndDate: true,
  renewalBehavior: 'after-expiry',
};

describe('plan rules', () => {
  it('accepts valid calendar and pricing rules', () => expect(validatePlan(valid)).toEqual({}));

  it('validates fixed precision values and future policy fields', () => {
    expect(
      validatePlan({
        ...valid,
        name: '',
        durationValue: 0,
        priceMinor: -1,
        admissionFeeMinor: -1,
        currencyCode: 'inr',
        taxRateBasisPoints: 10_001,
        discountValue: 10_001,
        colorHex: 'green',
        maxFreezeDays: null,
      }),
    ).toEqual({
      name: 'required',
      durationValue: 'invalid',
      priceMinor: 'invalid',
      admissionFeeMinor: 'invalid',
      currencyCode: 'invalid',
      taxRateBasisPoints: 'invalid',
      discountValue: 'invalid',
      colorHex: 'invalid',
      maxFreezeDays: 'invalid',
    });
  });

  it('parses localized Indian money entry without floating point storage', () => {
    expect(parseMoneyInput('₹1,25,000.50')).toBe(12_500_050);
    expect(parseMoneyInput('1200.5')).toBe(120_050);
    expect(parseMoneyInput('12.345')).toBeNull();
    expect(formatMoneyInput(120_050)).toBe('1200.50');
  });
});
