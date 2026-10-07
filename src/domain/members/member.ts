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
