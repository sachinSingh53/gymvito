import type { AppLanguage } from '@/domain/onboarding/onboarding';
import { parseDateOnly, type DateOnly } from '@/domain/dates/date-rules';

type RegionalSettings = Readonly<{
  language: AppLanguage;
  currencyCode: string;
  dateFormat: 'day-month-year' | 'month-day-year' | 'year-month-day';
  timeFormat: '12-hour' | '24-hour';
}>;

function localeFor(language: AppLanguage): string {
  return language === 'hi' ? 'hi-IN' : 'en-IN';
}

export function formatMoneyMinor(
  minor: number,
  settings: Pick<RegionalSettings, 'language' | 'currencyCode'>,
): string {
  return new Intl.NumberFormat(localeFor(settings.language), {
    style: 'currency',
    currency: settings.currencyCode,
  }).format(minor / 100);
}

export function formatInstant(
  instant: Date,
  settings: Pick<RegionalSettings, 'language' | 'dateFormat' | 'timeFormat'>,
  timeZone: string,
): string {
  const dateStyle = settings.dateFormat === 'year-month-day' ? 'short' : 'medium';
  return new Intl.DateTimeFormat(localeFor(settings.language), {
    dateStyle,
    timeStyle: 'short',
    hour12: settings.timeFormat === '12-hour',
    timeZone,
  }).format(instant);
}

export function formatDateOnly(
  value: DateOnly,
  settings: Pick<RegionalSettings, 'language' | 'dateFormat'>,
): string {
  return new Intl.DateTimeFormat(localeFor(settings.language), {
    day: '2-digit',
    month: settings.dateFormat === 'year-month-day' ? '2-digit' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateOnly(value));
}
