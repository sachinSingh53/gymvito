import {
  memberInitials,
  normalizeEmail,
  normalizeMemberCode,
  normalizePhone,
  normalizeSearchText,
  validateMember,
  type MemberInput,
} from './member';

const valid: MemberInput = {
  name: 'अमित Sharma',
  phone: '+91 12345 44521',
  email: 'owner@example.com',
  dateOfBirth: '1995-02-28',
  gender: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningSource: '',
  note: '',
};

describe('member normalization', () => {
  it('normalizes Unicode, punctuation, spaces, phones, email and codes', () => {
    expect(normalizeSearchText('  José—कुमार  Singh ')).toBe('josé कुमार singh');
    expect(normalizePhone('+91 12345-44521')).toBe('1234544521');
    expect(normalizePhone('01234544521')).toBe('1234544521');
    expect(normalizeEmail(' Owner@example.com ')).toBe('owner@example.com');
    expect(normalizeMemberCode('gv-000 42')).toBe('GV00042');
    expect(memberInitials('अमित Sharma')).toBe('अS');
  });

  it('validates optional identifiers and date-only values', () => {
    expect(validateMember(valid)).toEqual({});
    expect(
      validateMember({ ...valid, name: '', phone: '123', email: 'bad', dateOfBirth: '2026-02-30' }),
    ).toEqual({ name: 'required', phone: 'invalid', email: 'invalid', dateOfBirth: 'invalid' });
  });
});
