import type { TFunction } from 'i18next';

import { isMemberGender, MEMBER_GENDERS, normalizeGender } from '@/domain/members/member';

const GENDER_LABELS = {
  male: 'genderMale',
  female: 'genderFemale',
  other: 'genderOther',
} as const;

/** Display text for a stored gender: the translated label for a code, else the stored text. */
export function genderLabel(value: string, t: TFunction): string {
  const gender = normalizeGender(value);
  return isMemberGender(gender) ? t(GENDER_LABELS[gender]) : gender;
}

/**
 * Options for the gender dropdown. A value from before gender was a fixed choice that does not
 * map to a code is offered as its own option, so editing a member does not drop it.
 */
export function genderOptions(current: string, t: TFunction) {
  const options: { value: string; label: string }[] = [
    { value: '', label: t('genderNotSpecified') },
    ...MEMBER_GENDERS.map((value) => ({ value, label: t(GENDER_LABELS[value]) })),
  ];
  if (current && !isMemberGender(current)) options.push({ value: current, label: current });
  return options;
}
