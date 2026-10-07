export type DateOnly = `${number}-${number}-${number}`;

export type PlanDuration = Readonly<{
  count: number;
  unit: 'day' | 'week' | 'month' | 'year';
}>;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateOnly(date: Date): DateOnly {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as DateOnly;
}

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error('INVALID_DATE_ONLY');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('INVALID_DATE_ONLY');
  }

  return parsed;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addCalendarMonths(start: Date, months: number): Date {
  const absoluteMonth = start.getUTCMonth() + months;
  const targetYear = start.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const targetDay = Math.min(start.getUTCDate(), daysInMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

/**
 * A plan lasts for the requested calendar duration and has an inclusive end date.
 * Month/year anniversaries clamp to the target month's final day before subtracting one day.
 */
export function calculateInclusiveEndDate(startDate: DateOnly, duration: PlanDuration): DateOnly {
  if (!Number.isSafeInteger(duration.count) || duration.count <= 0) {
    throw new Error('INVALID_PLAN_DURATION');
  }

  const start = parseDateOnly(startDate);
  let exclusiveEnd: Date;

  switch (duration.unit) {
    case 'day':
      exclusiveEnd = new Date(start);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + duration.count);
      break;
    case 'week':
      exclusiveEnd = new Date(start);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + duration.count * 7);
      break;
    case 'month':
      exclusiveEnd = addCalendarMonths(start, duration.count);
      break;
    case 'year':
      exclusiveEnd = addCalendarMonths(start, duration.count * 12);
      break;
  }

  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() - 1);
  return toDateOnly(exclusiveEnd);
}

export function compareDateOnly(left: DateOnly, right: DateOnly): -1 | 0 | 1 {
  parseDateOnly(left);
  parseDateOnly(right);
  return left === right ? 0 : left < right ? -1 : 1;
}

export function renewalStartAfterExpiry(currentEndDate: DateOnly): DateOnly {
  return addDays(currentEndDate, 1);
}

export function dateOnlyAtInstant(instant: Date, timeZone: string): DateOnly {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}` as DateOnly;
}
