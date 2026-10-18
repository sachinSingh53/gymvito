import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DuplicateMember,
  MemberPhotoInput,
  MemberRecord,
} from '@/data/repositories/phase2-repository';
import { normalizeGender, validateMember, type MemberInput } from '@/domain/members/member';
import { genderOptions } from '@/features/members/gender';
import { useAppSession } from '@/features/session/app-session-context';
import {
  CAMERA_PERMISSION_DENIED,
  captureMemberPhoto,
  memberPhotoDataUri,
  pickMemberPhoto,
} from '@/platform/images/member-photo';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import { AppDateField, localDateToDateOnly } from '@/ui/components/date-field';
import { AppSelectField, FormActions, FormRow, FormSection } from '@/ui/components/form-layout';
import { LocalDataBadge, MaterialSymbol, SurfaceCard } from '@/ui/components/operational-shell';
import { actionPressed, colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

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
          gender: normalizeGender(member.gender),
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

  const choosePhoto = async (source: 'camera' | 'library') => {
    const { photo: _previous, ...otherErrors } = errors;
    setErrors(otherErrors);
    try {
      const selected = await (source === 'camera' ? captureMemberPhoto() : pickMemberPhoto());
      if (selected) setPhoto(selected);
    } catch (error) {
      const denied = error instanceof Error && error.message === CAMERA_PERMISSION_DENIED;
      setErrors({ ...otherErrors, photo: denied ? 'camera' : 'invalid' });
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
        router.back();
      } else {
        await repository.createMember(form, state.ownerId, photo);
        router.replace('/members');
      }
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
      <FormSection icon="badge" title={t('memberIdentity')}>
        <View style={styles.photoRow}>
          <Pressable
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            onPress={() => void choosePhoto('camera')}
            style={({ pressed }) => [styles.avatar, pressed && actionPressed]}
          >
            {displayedPhoto ? (
              <Image source={{ uri: memberPhotoDataUri(displayedPhoto) }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <MaterialSymbol color={colors.primaryDark} name="person" size={40} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <MaterialSymbol color={colors.onPrimary} name="photo_camera" size={16} />
            </View>
          </Pressable>
          <View style={styles.photoActions}>
            <AppButton
              icon={<MaterialSymbol color={colors.primaryDark} name="photo_camera" size={20} />}
              onPress={() => void choosePhoto('camera')}
              variant="secondary"
            >
              {t('takePhoto')}
            </AppButton>
            <View style={styles.photoSecondaryRow}>
              <AppButton
                icon={<MaterialSymbol color={colors.primaryDark} name="photo_library" size={20} />}
                onPress={() => void choosePhoto('library')}
                style={styles.photoChoose}
                variant="secondary"
              >
                {t('choosePhoto')}
              </AppButton>
              {displayedPhoto ? (
                <AppButton
                  accessibilityLabel={t('removePhoto')}
                  icon={<MaterialSymbol color={colors.dangerText} name="delete" size={22} />}
                  iconOnly
                  onPress={() => setPhoto(null)}
                  variant="dangerTonal"
                />
              ) : null}
            </View>
          </View>
        </View>
        {errors.photo ? (
          <Notice danger>
            {errors.photo === 'camera' ? t('cameraPermissionDenied') : t('photoFailed')}
          </Notice>
        ) : null}
        <AppField
          autoCapitalize="words"
          error={errorFor('name')}
          icon="person"
          label={t('memberName')}
          onChangeText={(value) => update('name', value)}
          value={form.name}
        />
        <FormRow minItemWidth={220}>
          <AppField
            error={errorFor('phone')}
            hint={t('indiaPhoneHint')}
            icon="call"
            keyboardType="phone-pad"
            label={t('phoneOptional')}
            onChangeText={(value) => update('phone', value)}
            value={form.phone}
          />
          <AppField
            autoCapitalize="none"
            error={errorFor('email')}
            icon="mail"
            keyboardType="email-address"
            label={t('emailOptional')}
            onChangeText={(value) => update('email', value)}
            value={form.email}
          />
        </FormRow>
        {existing ? (
          <View style={styles.codeReadOnly}>
            <MaterialSymbol color={colors.primaryDark} name="qr_code_2" size={22} />
            <Text style={styles.codeLabel}>{t('memberCode')}</Text>
            <Text style={styles.codeValue}>{existing.memberCode}</Text>
          </View>
        ) : (
          <View style={styles.codeReadOnly}>
            <MaterialSymbol color={colors.primaryDark} name="qr_code_2" size={22} />
            <Text style={styles.codeHint}>{t('memberCodeGenerated')}</Text>
          </View>
        )}
      </FormSection>
      <FormSection icon="person_book" title={t('personalDetails')}>
        <FormRow minItemWidth={200}>
          <AppDateField
            error={errorFor('dateOfBirth')}
            label={t('dateOfBirth')}
            maximumDate={localDateToDateOnly(new Date())}
            onChangeText={(value) => update('dateOfBirth', value)}
            value={form.dateOfBirth}
          />
          <AppSelectField
            icon="wc"
            label={t('genderOptional')}
            onChange={(value) => update('gender', value)}
            options={genderOptions(form.gender, t)}
            placeholder={t('genderNotSpecified')}
            value={form.gender}
          />
        </FormRow>
        <AppField
          icon="home"
          label={t('addressOptional')}
          multiline
          onChangeText={(value) => update('address', value)}
          value={form.address}
        />
        <AppField
          icon="campaign"
          label={t('joiningSource')}
          onChangeText={(value) => update('joiningSource', value)}
          value={form.joiningSource}
        />
      </FormSection>
      <FormSection icon="emergency" title={t('emergencyAndNotes')}>
        <FormRow minItemWidth={220}>
          <AppField
            icon="contact_emergency"
            label={t('emergencyContactName')}
            onChangeText={(value) => update('emergencyContactName', value)}
            value={form.emergencyContactName}
          />
          <AppField
            icon="call"
            keyboardType="phone-pad"
            label={t('emergencyContactPhone')}
            onChangeText={(value) => update('emergencyContactPhone', value)}
            value={form.emergencyContactPhone}
          />
        </FormRow>
        <AppField
          hint={memberId ? t('noteAppendHint') : undefined}
          icon="sticky_note_2"
          label={t('memberNote')}
          multiline
          onChangeText={(value) => update('note', value)}
          value={form.note}
        />
      </FormSection>
      {duplicates.length ? (
        <SurfaceCard style={styles.duplicateCard}>
          <View style={styles.duplicateHeader}>
            <MaterialSymbol color={colors.warningText} name="group" size={22} />
            <Text style={styles.duplicateTitle}>{t('duplicateWarningTitle')}</Text>
          </View>
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
      <FormActions
        onPrimary={() => void save()}
        onSecondary={() => router.back()}
        primaryDisabled={busy || (duplicates.length > 0 && !duplicatesAcknowledged)}
        primaryIcon={memberId ? 'save' : 'person_add'}
        primaryLabel={busy ? t('saving') : memberId ? t('saveChanges') : t('addMember')}
        secondaryLabel={t('cancel')}
      />
    </View>
  );
}

const AVATAR = 88;

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: AVATAR, height: AVATAR },
  photo: {
    width: AVATAR,
    height: AVATAR,
    borderWidth: 2,
    borderColor: glass.rim,
    borderRadius: AVATAR / 2,
  },
  photoPlaceholder: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: glass.rimPrimary,
    borderRadius: AVATAR / 2,
    backgroundColor: glass.fillAccent,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  photoActions: { minWidth: 0, flex: 1, gap: spacing.sm },
  photoSecondaryRow: { minWidth: 0, flexDirection: 'row', gap: spacing.sm },
  photoChoose: { minWidth: 0, flex: 1 },
  codeReadOnly: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: glass.rimPrimary,
    borderRadius: radii.lg,
    backgroundColor: glass.fillAccent,
  },
  codeLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  codeHint: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  codeValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.8,
  },
  duplicateCard: {
    gap: spacing.sm,
    borderColor: glass.rimWarning,
    backgroundColor: glass.tintWarning,
  },
  duplicateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  duplicateTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.warningText,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  duplicateText: {
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  duplicateMatch: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
});
