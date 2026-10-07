import { isValidPin, validateGymSetup, type GymSetupInput } from './onboarding';

const validGym: GymSetupInput = {
  gymName: 'North Star Fitness',
  ownerName: 'Owner',
  phone: '',
  email: '',
  address: '',
  receiptFooter: '',
  currencyCode: 'INR',
  dateFormat: 'day-month-year',
  timeFormat: '12-hour',
  weekStartsOn: 1,
  financialYearStartMonth: 4,
  financialYearStartDay: 1,
};

describe('onboarding validation', () => {
  it('accepts a complete local gym profile', () => {
    expect(validateGymSetup(validGym)).toEqual({});
  });

  it('rejects invalid required and regional values', () => {
    expect(
      validateGymSetup({
        ...validGym,
        gymName: '',
        ownerName: ' ',
        email: 'bad-address',
        currencyCode: 'inr',
        financialYearStartMonth: 13,
        financialYearStartDay: 0,
      }),
    ).toEqual({
      gymName: 'required',
      ownerName: 'required',
      email: 'invalid',
      currencyCode: 'invalid',
      financialYearStartMonth: 'invalid',
      financialYearStartDay: 'invalid',
    });
  });

  it('requires a numeric PIN between six and twelve digits', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123456789012')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
  });
});
