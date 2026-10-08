import type { File } from 'expo-file-system';
import { Redirect, router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppSession } from '@/features/session/app-session-context';
import { setAppLanguage } from '@/i18n';
import type { BackupManifest } from '@/platform/backup/backup-manifest';
import { pickGymVitoBackup } from '@/platform/files/document-files';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, AppCheckbox, AppChoice, AppField, Notice } from '@/ui/components/core-controls';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

export default function RecoveryRoute() {
  const { state, previewRecoveryBackup, recoverFromBackup } = useAppSession();
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [preview, setPreview] = useState<BackupManifest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nativeReady = getRuntimeCapabilities().nativeSecurityProofs;

  if (state.status === 'locked' || state.status === 'unlocked') return <Redirect href="/" />;

  const choose = async () => {
    setError(null);
    try {
      const selected = await pickGymVitoBackup();
      if (!selected) return;
      setFile(selected);
      setPreview(null);
    } catch {
      setError(t('restoreWrongFile'));
    }
  };

  const validate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewRecoveryBackup(file, passphrase));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/newer/i.test(message) ? t('restoreNewerVersion') : t('restoreValidationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!file || !preview || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await recoverFromBackup(file, passphrase);
    } catch {
      setError(t('restoreFailedPreserved'));
      setBusy(false);
    }
  };

  return (
    <AppScreen title={t('recoveryRestoreTitle')} subtitle={t('recoveryRestoreSubtitle')}>
      <View accessibilityRole="radiogroup" style={styles.languageRow}>
        <AppChoice
          label="English"
          onPress={() => void setAppLanguage('en')}
          selected={i18n.language === 'en'}
        />
        <AppChoice
          label="हिन्दी"
          onPress={() => void setAppLanguage('hi')}
          selected={i18n.language === 'hi'}
        />
      </View>
      {!nativeReady ? <Notice danger>{t('backupNativeBuildRequired')}</Notice> : null}
      <Notice danger>{t('recoveryRestoreNotice')}</Notice>
      <AppButton disabled={!nativeReady || busy} onPress={() => void choose()} variant="secondary">
        {file ? file.name : t('selectGymVitoFile')}
      </AppButton>
      <AppField
        autoCapitalize="none"
        label={t('backupPassphrase')}
        maxLength={512}
        onChangeText={(value) => {
          setPassphrase(value);
          setPreview(null);
        }}
        secureTextEntry
        value={passphrase}
      />
      <AppButton
        disabled={!nativeReady || busy || !file || passphrase.length < 12}
        onPress={() => void validate()}
      >
        {busy && !preview ? t('validatingBackup') : t('validateAndPreview')}
      </AppButton>
      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.gym}>{preview.gymName}</Text>
          <Text style={styles.detail}>
            {new Intl.DateTimeFormat(i18n.language, {
              dateStyle: 'long',
              timeStyle: 'short',
            }).format(new Date(preview.createdAtUtc))}
          </Text>
          <Text style={styles.detail}>
            {t('recoveryPreviewCounts', {
              members: preview.recordCounts.member ?? 0,
              payments: preview.recordCounts.payment ?? 0,
            })}
          </Text>
        </View>
      ) : null}
      {preview ? (
        <>
          <AppCheckbox
            label={t('recoveryConfirmation')}
            onPress={() => setConfirmed((value) => !value)}
            selected={confirmed}
          />
          <AppButton disabled={busy || !confirmed} onPress={() => void restore()} variant="danger">
            {busy ? t('restoringBackup') : t('recoverThisDevice')}
          </AppButton>
        </>
      ) : null}
      {error ? <Notice danger>{error}</Notice> : null}
      {state.status !== 'recovery-error' ? (
        <AppButton onPress={() => router.replace('/' as Href)} variant="secondary">
          {t('back')}
        </AppButton>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  languageRow: { gap: spacing.sm },
  preview: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceLow,
  },
  gym: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  detail: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
});
