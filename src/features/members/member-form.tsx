import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DuplicateMember,
  MemberPhotoInput,
  MemberRecord,
} from '@/data/repositories/phase2-repository';
import { validateMember, type MemberInput } from '@/domain/members/member';
import { useAppSession } from '@/features/session/app-session-context';
import { memberPhotoDataUri, pickMemberPhoto } from '@/platform/images/member-photo';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import { LocalDataBadge, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

const DUPLICATE_LABELS = {
  phone: 'duplicatePhone',
  email: 'duplicateEmail',
  code: 'duplicateCode',
} as const;

const EMPTY_MEMBER: MemberInput = {
  name: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningSource: '',
  note: '',
};

export function MemberForm({ memberId }: { memberId?: string }) {
  const { state, getPhase2Repository } = useAppSession();
  const { t } = useTranslation();
  const [existing, setExisting] = useState<MemberRecord | null>(null);
  const [form, setForm] = useState<MemberInput>(EMPTY_MEMBER);
  const [photo, setPhoto] = useState<MemberPhotoInput | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<readonly DuplicateMember[]>([]);
  const [duplicatesAcknowledged, setDuplicatesAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(memberId));
  const [loadError, setLoadError] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    void getPhase2Repository()
      .getMember(memberId)
      .then((member) => {
        if (!active) return;
        if (!member) {
          setLoadError(true);
          return;
        }
        setExisting(member);
        setForm({
          name: member.name,
          phone: member.phone,
          email: member.email,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender,
          address: member.address,
          emergencyContactName: member.emergencyContactName,
          emergencyContactPhone: member.emergencyContactPhone,
          joiningSource: member.joiningSource,
          note: '',
        });
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getPhase2Repository, memberId]);

  if (state.status !== 'unlocked') return null;
  const update = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) => {
    setDuplicatesAcknowledged(false);
    setDuplicates([]);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const errorFor = (key: string) => (errors[key] ? t('fieldInvalid') : undefined);
  const displayedPhoto = photo === undefined ? existing?.photo : photo;

  const choosePhoto = async () => {
    try {
      const selected = await pickMemberPhoto();
      if (selected) setPhoto(selected);
    } catch {
      setErrors({ ...errors, photo: 'invalid' });
    }
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    try {
      const nextErrors = validateMember(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      const repository = getPhase2Repository();
      const matches = await repository.findDuplicates(form, memberId);
      if (matches.length && !duplicatesAcknowledged) {
        setDuplicates(matches);
        return;
      }
      if (memberId) {
        await repository.updateMember(memberId, form, state.ownerId, photo);
      } else {
        await repository.createMember(form, state.ownerId, photo);
      }
      router.back();
    } catch {
      setErrors({ form: 'save' });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={t('loading')} />;
  if (loadError) {
    return (
      <View style={styles.form}>
        <Notice danger>{t('memberLoadFailed')}</Notice>
        <AppButton onPress={() => router.back()} variant="secondary">
          {t('back')}
        </AppButton>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <LocalDataBadge />
      {errors.form ? <Notice danger>{t('memberSaveFailed')}</Notice> : null}
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('memberIdentity')}</Text>
        <View style={styles.photoRow}>
          {displayedPhoto ? (
            <Image source={{ uri: memberPhotoDataUri(displayedPhoto) }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoGlyph}>＋</Text>
            </View>
          )}
          <View style={styles.photoActions}>
            <AppButton onPress={() => void choosePhoto()} variant="secondary">
              {t('choosePhoto')}
            </AppButton>
            {displayedPhoto ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPhoto(null)}
                style={styles.removePhoto}
              >
                <Text style={styles.removePhotoText}>{t('removePhoto')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {errors.photo ? <Notice danger>{t('photoFailed')}</Notice> : null}
        <AppField
          autoCapitalize="words"
          error={errorFor('name')}
          label={t('memberName')}
          onChangeText={(value) => update('name', value)}
          value={form.name}
        />
        <AppField
          keyboardType="phone-pad"
          error={errorFor('phone')}
          hint={t('indiaPhoneHint')}
          label={t('phoneOptional')}
          onChangeText={(value) => update('phone', value)}
          value={form.phone}
        />
        <AppField
          autoCapitalize="none"
          error={errorFor('email')}
          keyboardType="email-address"
          label={t('emailOptional')}
          onChangeText={(value) => update('email', value)}
          value={form.email}
        />
        {existing ? (
          <View style={styles.codeReadOnly}>
            <Text style={styles.codeLabel}>{t('memberCode')}</Text>
            <Text style={styles.codeValue}>{existing.memberCode}</Text>
          </View>
        ) : (
          <Notice>{t('memberCodeGenerated')}</Notice>
        )}
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('personalDetails')}</Text>
        <AppField
          error={errorFor('dateOfBirth')}
          hint="YYYY-MM-DD"
          label={t('dateOfBirth')}
          onChangeText={(value) => update('dateOfBirth', value)}
          value={form.dateOfBirth}
        />
        <AppField
          label={t('genderOptional')}
          onChangeText={(value) => update('gender', value)}
          value={form.gender}
        />
        <AppField
          label={t('addressOptional')}
          multiline
          onChangeText={(value) => update('address', value)}
          value={form.address}
        />
        <AppField
          label={t('joiningSource')}
          onChangeText={(value) => update('joiningSource', value)}
          value={form.joiningSource}
        />
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('emergencyAndNotes')}</Text>
        <AppField
          label={t('emergencyContactName')}
          onChangeText={(value) => update('emergencyContactName', value)}
          value={form.emergencyContactName}
        />
        <AppField
          keyboardType="phone-pad"
          label={t('emergencyContactPhone')}
          onChangeText={(value) => update('emergencyContactPhone', value)}
          value={form.emergencyContactPhone}
        />
        <AppField
          hint={memberId ? t('noteAppendHint') : undefined}
          label={t('memberNote')}
          multiline
          onChangeText={(value) => update('note', value)}
          value={form.note}
        />
      </SurfaceCard>
      {duplicates.length ? (
        <SurfaceCard style={styles.duplicateCard}>
          <Text style={styles.duplicateTitle}>{t('duplicateWarningTitle')}</Text>
          <Text style={styles.duplicateText}>{t('duplicateWarningMessage')}</Text>
          {duplicates.map((match) => (
            <Text key={match.id} style={styles.duplicateMatch}>
              {match.name} • {match.memberCode} • {t(DUPLICATE_LABELS[match.match])}
            </Text>
          ))}
          <AppButton onPress={() => setDuplicatesAcknowledged(true)} variant="secondary">
            {t('saveWithoutMerging')}
          </AppButton>
        </SurfaceCard>
      ) : null}
      <View style={styles.actions}>
        <AppButton
          disabled={busy || (duplicates.length > 0 && !duplicatesAcknowledged)}
          onPress={() => void save()}
        >
          {busy ? t('saving') : memberId ? t('saveChanges') : t('addMember')}
        </AppButton>
        <AppButton onPress={() => router.back()} variant="secondary">
          {t('cancel')}
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: colors.surfaceHigh,
  },
  photoGlyph: { color: colors.primaryDark, fontFamily: fonts.regular, fontSize: 32 },
  photoActions: { flex: 1, gap: spacing.sm },
  removePhoto: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 13 },
  codeReadOnly: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLow,
  },
  codeLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  codeValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.8,
  },
  duplicateCard: {
    gap: spacing.sm,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
  },
  duplicateTitle: { color: colors.warningText, fontFamily: fonts.bold, fontSize: 16 },
  duplicateText: {
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  duplicateMatch: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
  actions: { gap: spacing.sm },
});
