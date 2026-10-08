import type { File } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BackupHistoryRecord } from '@/data/repositories/phase5-repository';
import { useAppSession } from '@/features/session/app-session-context';
import type { BackupManifest } from '@/platform/backup/backup-manifest';
import { pickGymVitoBackup } from '@/platform/files/document-files';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import {
  AppButton,
  AppCheckbox,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import { OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

type Mode = 'overview' | 'create' | 'restore' | 'delete';

function safeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (error.message === 'OWNER_REAUTHENTICATION_REQUIRED') return 'owner-auth';
  if (/passphrase/i.test(error.message)) return 'passphrase';
  if (/newer/i.test(error.message)) return 'newer';
  if (/storage/i.test(error.message)) return 'storage';
  if (/GymVito backup|application/i.test(error.message)) return 'wrong-file';
  return fallback;
}

export default function BackupRestoreRoute() {
  const { width } = useWindowDimensions();
  const tablet = width >= 760;
  const { t, i18n } = useTranslation();
  const {
    state,
    getBackupService,
    createBackup,
    previewBackup,
    restoreBackup,
    deleteAllLocalData,
  } = useAppSession();
  const nativeReady = getRuntimeCapabilities().nativeSecurityProofs;
  const [mode, setMode] = useState<Mode>('overview');
  const [history, setHistory] = useState<BackupHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupManifest | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await getBackupService().listHistory());
    } catch {
      setHistory([]);
      setMessage(t('backupHistoryLoadFailed'));
    } finally {
      setLoadingHistory(false);
    }
  }, [getBackupService, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getBackupService()
        .listHistory()
        .then((records) => {
          if (active) setHistory(records);
        })
        .catch(() => {
          if (active) {
            setHistory([]);
            setMessage(t('backupHistoryLoadFailed'));
          }
        })
        .finally(() => {
          if (active) setLoadingHistory(false);
        });
      return () => {
        active = false;
      };
    }, [getBackupService, t]),
  );

  const resetSensitive = (next: Mode) => {
    setOwnerPin('');
    setPassphrase('');
    setConfirmPassphrase('');
    setSelectedFile(null);
    setPreview(null);
    setRestoreConfirmed(false);
    setDeleteText('');
    setDeleteAcknowledged(false);
    setMessage(null);
    setMode(next);
  };

  const displayMessage = useMemo(() => {
    if (!message) return null;
    if (message === 'owner-auth') return t('backupOwnerPinIncorrect');
    if (message === 'passphrase') return t('backupPassphraseInvalid');
    if (message === 'newer') return t('restoreNewerVersion');
    if (message === 'storage') return t('backupLowStorage');
    if (message === 'wrong-file') return t('restoreWrongFile');
    return message;
  }, [message, t]);

  if (state.status !== 'unlocked') return null;

  const create = async () => {
    if (passphrase !== confirmPassphrase) {
      setMessage(t('backupPassphraseMismatch'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = await createBackup(passphrase, ownerPin);
      setMessage(`✓ ${t('backupSaved', { file: saved.fileName })}`);
      setOwnerPin('');
      setPassphrase('');
      setConfirmPassphrase('');
      await refreshHistory();
    } catch (error) {
      setMessage(safeMessage(error, t('backupCreateFailed')));
    } finally {
      setBusy(false);
    }
  };

  const chooseRestore = async () => {
    setMessage(null);
    try {
      const file = await pickGymVitoBackup();
      if (!file) return;
      setSelectedFile(file);
      setPreview(null);
    } catch {
      setMessage('wrong-file');
    }
  };

  const inspectRestore = async () => {
    if (!selectedFile) return;
    setBusy(true);
    setMessage(null);
    try {
      setPreview(await previewBackup(selectedFile, passphrase));
    } catch (error) {
      setPreview(null);
      setMessage(safeMessage(error, t('restoreValidationFailed')));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!selectedFile || !preview || !restoreConfirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      await restoreBackup(selectedFile, passphrase, ownerPin);
    } catch (error) {
      setMessage(safeMessage(error, t('restoreFailedPreserved')));
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const deleted = await deleteAllLocalData(ownerPin);
      if (!deleted) {
        setMessage('owner-auth');
        setBusy(false);
      }
    } catch {
      setMessage(t('deleteAllFailed'));
      setBusy(false);
    }
  };

  return (
    <OperationalShell
      active="more"
      subtitle={t('backupCenterSubtitle')}
      title={t('backupCenterTitle')}
    >
      {!nativeReady ? <Notice danger>{t('backupNativeBuildRequired')}</Notice> : null}
      {mode === 'overview' ? (
        <>
          <View style={[styles.actionGrid, tablet && styles.actionGridTablet]}>
            <ActionCard
              body={t('createBackupCardBody')}
              button={t('createBackup')}
              disabled={!nativeReady}
              onPress={() => resetSensitive('create')}
              title={t('createBackupCardTitle')}
            />
            <ActionCard
              body={t('restoreBackupCardBody')}
              button={t('restoreBackup')}
              disabled={!nativeReady}
              onPress={() => resetSensitive('restore')}
              title={t('restoreBackupCardTitle')}
            />
          </View>
          <Notice>{t('backupLocalOnlyNotice')}</Notice>
          <SurfaceCard style={styles.historyCard}>
            <Text style={styles.sectionTitle}>{t('backupHistory')}</Text>
            {loadingHistory ? <LoadingState label={t('loading')} /> : null}
            {!loadingHistory && history.length === 0 ? (
              <Text style={styles.muted}>{t('noBackupHistory')}</Text>
            ) : null}
            {history.map((record) => (
              <View key={record.id} style={styles.historyRow}>
                <View style={styles.flexCopy}>
                  <Text style={styles.historyTitle}>
                    {record.operationType === 'backup' ? t('historyBackup') : t('historyRestore')}
                  </Text>
                  <Text style={styles.muted}>
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(record.completedAtUtc ?? record.startedAtUtc))}
                    {record.targetDescriptor ? ` • ${record.targetDescriptor}` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.status,
                    record.result === 'success' ? styles.statusSuccess : styles.statusDanger,
                  ]}
                >
                  {t(`backupResult_${record.result}`)}
                </Text>
              </View>
            ))}
          </SurfaceCard>
          <SurfaceCard style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>{t('deleteAllTitle')}</Text>
            <Text style={styles.muted}>{t('deleteAllCardBody')}</Text>
            <AppButton onPress={() => resetSensitive('delete')} variant="danger">
              {t('reviewDeleteAll')}
            </AppButton>
          </SurfaceCard>
        </>
      ) : null}

      {mode === 'create' ? (
        <SurfaceCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t('createEncryptedBackup')}</Text>
          <Notice danger>{t('backupPassphraseWarning')}</Notice>
          <AppField
            autoCapitalize="none"
            label={t('backupPassphrase')}
            maxLength={512}
            onChangeText={setPassphrase}
            secureTextEntry
            value={passphrase}
          />
          <AppField
            autoCapitalize="none"
            label={t('confirmBackupPassphrase')}
            maxLength={512}
            onChangeText={setConfirmPassphrase}
            secureTextEntry
            value={confirmPassphrase}
          />
          <Text style={styles.hint}>{t('backupPassphraseGuidance')}</Text>
          <AppField
            keyboardType="number-pad"
            label={t('ownerPin')}
            maxLength={12}
            onChangeText={setOwnerPin}
            secureTextEntry
            value={ownerPin}
          />
          {displayMessage ? (
            <Notice danger={!message?.startsWith('✓')}>{displayMessage}</Notice>
          ) : null}
          <AppButton
            disabled={busy || passphrase.length < 12 || ownerPin.length < 6}
            onPress={() => void create()}
          >
            {busy ? t('creatingBackup') : t('chooseDestinationAndSave')}
          </AppButton>
          <AppButton disabled={busy} onPress={() => resetSensitive('overview')} variant="secondary">
            {t('cancel')}
          </AppButton>
        </SurfaceCard>
      ) : null}

      {mode === 'restore' ? (
        <SurfaceCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t('restoreEncryptedBackup')}</Text>
          <Notice danger>{t('restoreReplacesNotice')}</Notice>
          <AppButton disabled={busy} onPress={() => void chooseRestore()} variant="secondary">
            {selectedFile ? selectedFile.name : t('selectGymVitoFile')}
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
            disabled={busy || !selectedFile || passphrase.length < 12}
            onPress={() => void inspectRestore()}
          >
            {busy ? t('validatingBackup') : t('validateAndPreview')}
          </AppButton>
          {preview ? <RestorePreview manifest={preview} /> : null}
          {preview ? (
            <>
              <AppCheckbox
                label={t('restoreConfirmation')}
                onPress={() => setRestoreConfirmed((value) => !value)}
                selected={restoreConfirmed}
              />
              <AppField
                keyboardType="number-pad"
                label={t('ownerPin')}
                maxLength={12}
                onChangeText={setOwnerPin}
                secureTextEntry
                value={ownerPin}
              />
              <AppButton
                disabled={busy || !restoreConfirmed || ownerPin.length < 6}
                onPress={() => void restore()}
                variant="danger"
              >
                {busy ? t('restoringBackup') : t('confirmRestore')}
              </AppButton>
            </>
          ) : null}
          {displayMessage ? <Notice danger>{displayMessage}</Notice> : null}
          <AppButton disabled={busy} onPress={() => resetSensitive('overview')} variant="secondary">
            {t('cancel')}
          </AppButton>
        </SurfaceCard>
      ) : null}

      {mode === 'delete' ? (
        <SurfaceCard style={styles.deleteCard}>
          <Text style={styles.dangerTitle}>{t('deleteAllTitle')}</Text>
          <Notice danger>{t('deleteAllPermanentNotice')}</Notice>
          <AppButton onPress={() => resetSensitive('create')} variant="secondary">
            {t('createBackupFirst')}
          </AppButton>
          <AppCheckbox
            label={t('deleteBackupAcknowledgement')}
            onPress={() => setDeleteAcknowledged((value) => !value)}
            selected={deleteAcknowledged}
          />
          <AppField
            autoCapitalize="characters"
            label={t('typeDeleteLabel')}
            onChangeText={setDeleteText}
            value={deleteText}
          />
          <AppField
            keyboardType="number-pad"
            label={t('ownerPin')}
            maxLength={12}
            onChangeText={setOwnerPin}
            secureTextEntry
            value={ownerPin}
          />
          {displayMessage ? <Notice danger>{displayMessage}</Notice> : null}
          <AppButton
            disabled={
              busy || !deleteAcknowledged || deleteText.trim() !== 'DELETE' || ownerPin.length < 6
            }
            onPress={() => void deleteAll()}
            variant="danger"
          >
            {busy ? t('deletingAllData') : t('permanentlyDeleteAll')}
          </AppButton>
          <AppButton disabled={busy} onPress={() => resetSensitive('overview')} variant="secondary">
            {t('cancel')}
          </AppButton>
        </SurfaceCard>
      ) : null}

      <AppButton onPress={() => router.back()} variant="secondary">
        {t('back')}
      </AppButton>
    </OperationalShell>
  );
}

function ActionCard({
  title,
  body,
  button,
  disabled,
  onPress,
}: {
  title: string;
  body: string;
  button: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <SurfaceCard style={styles.actionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
      <AppButton disabled={disabled} onPress={onPress}>
        {button}
      </AppButton>
    </SurfaceCard>
  );
}

function RestorePreview({ manifest }: { manifest: BackupManifest }) {
  const { t, i18n } = useTranslation();
  return (
    <View accessibilityLabel={t('restorePreview')} style={styles.preview}>
      <Text style={styles.previewTitle}>{manifest.gymName}</Text>
      <Text style={styles.muted}>
        {new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date(manifest.createdAtUtc))}
      </Text>
      <View style={styles.previewGrid}>
        <PreviewMetric label={t('backupMembers')} value={manifest.recordCounts.member ?? 0} />
        <PreviewMetric
          label={t('backupMemberships')}
          value={manifest.recordCounts.membership ?? 0}
        />
        <PreviewMetric label={t('backupInvoices')} value={manifest.recordCounts.invoice ?? 0} />
        <PreviewMetric label={t('backupPayments')} value={manifest.recordCounts.payment ?? 0} />
      </View>
      <Text style={styles.hint}>
        {t('backupCompatibility', {
          app: manifest.sourceAppVersion,
          schema: manifest.schemaVersion,
        })}
      </Text>
    </View>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.previewMetric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionGrid: { gap: spacing.md },
  actionGridTablet: { flexDirection: 'row' },
  actionCard: { minWidth: 0, flex: 1, gap: spacing.md },
  formCard: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.md },
  historyCard: { gap: 0 },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  muted: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  historyRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  flexCopy: { minWidth: 0, flex: 1, gap: spacing.xs },
  historyTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  status: {
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  statusSuccess: { color: colors.successText, backgroundColor: colors.successSurface },
  statusDanger: { color: colors.dangerText, backgroundColor: colors.dangerSurface },
  dangerCard: { gap: spacing.md, borderColor: colors.warningBorder },
  deleteCard: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.md },
  dangerTitle: { color: colors.danger, fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  preview: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceLow,
  },
  previewTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewMetric: {
    minWidth: 112,
    flex: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  metricValue: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 22 },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
});
