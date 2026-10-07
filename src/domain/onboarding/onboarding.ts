export const APP_LANGUAGES = ['en', 'hi'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const ONBOARDING_STEPS = [
  'language',
  'gym',
  'security',
  'backup-intro',
  'complete',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type GymSetupInput = Readonly<{
  gymName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  receiptFooter: string;
  currencyCode: string;
  dateFormat: 'day-month-year' | 'month-day-year' | 'year-month-day';
  timeFormat: '12-hour' | '24-hour';
  weekStartsOn: 0 | 1;
  financialYearStartMonth: number;
  financialYearStartDay: number;
}>;

export function validateGymSetup(input: GymSetupInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.gymName.trim().length < 2) errors.gymName = 'required';
  if (input.ownerName.trim().length < 2) errors.ownerName = 'required';
  if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) errors.email = 'invalid';
  if (!/^[A-Z]{3}$/.test(input.currencyCode)) errors.currencyCode = 'invalid';
  if (
    !Number.isInteger(input.financialYearStartMonth) ||
    input.financialYearStartMonth < 1 ||
    input.financialYearStartMonth > 12
  ) {
    errors.financialYearStartMonth = 'invalid';
  }
  if (
    !Number.isInteger(input.financialYearStartDay) ||
    input.financialYearStartDay < 1 ||
    input.financialYearStartDay > 31
  ) {
    errors.financialYearStartDay = 'invalid';
  }
  return errors;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6,12}$/.test(pin);
}
