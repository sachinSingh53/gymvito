import { parseDateOnly } from '@/domain/dates/date-rules';

export type MemberInput = Readonly<{
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningSource: string;
  note: string;
}>;

/** Stored gender codes. An empty string means not specified. */
export const MEMBER_GENDERS = ['male', 'female', 'other'] as const;
export type MemberGender = (typeof MEMBER_GENDERS)[number];

export function isMemberGender(value: string): value is MemberGender {
  return (MEMBER_GENDERS as readonly string[]).includes(value);
}

/** Free-text values typed before gender became a fixed choice, in English and Hindi. */
const LEGACY_GENDER_TEXT: Readonly<Record<string, MemberGender>> = {
  m: 'male',
  male: 'male',
  man: 'male',
  पुरुष: 'male',
  f: 'female',
  female: 'female',
  woman: 'female',
  महिला: 'female',
  स्त्री: 'female',
  other: 'other',
  अन्य: 'other',
};

/**
 * Maps a stored gender to its code. Older free-text values are matched where the meaning is
 * clear; anything else is returned trimmed and unchanged, so it is never silently lost.
 */
export function normalizeGender(value: string): MemberGender | string {
  const trimmed = value.trim();
  if (isMemberGender(trimmed)) return trimmed;
  return LEGACY_GENDER_TEXT[trimmed.normalize('NFKC').toLocaleLowerCase('en-US')] ?? trimmed;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function normalizeMemberCode(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, '').toLocaleUpperCase('en-US');
}

export function validateMember(input: MemberInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = 'required';
  const phone = normalizePhone(input.phone);
  if (input.phone.trim() && (phone.length < 7 || phone.length > 15)) errors.phone = 'invalid';
  if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) errors.email = 'invalid';
  if (input.dateOfBirth.trim()) {
    try {
      parseDateOnly(input.dateOfBirth.trim());
    } catch {
      errors.dateOfBirth = 'invalid';
    }
  }
  return errors;
}

export function memberInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '')
    .join('');
}
