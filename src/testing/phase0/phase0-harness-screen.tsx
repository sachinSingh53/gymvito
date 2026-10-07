import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { setAppLanguage, type AppLanguage } from '@/i18n';
import { pickGymVitoBackup } from '@/platform/files/document-files';
import {
  observeDeviceLocale,
  readDeviceLocale,
  type DeviceLocaleSnapshot,
} from '@/platform/localization/device-locale';
import {
  createBilingualPdf,
  deleteTemporaryPdf,
  printPdf,
  sharePdf,
} from '@/platform/printing/receipt-pdf';
import type { DatabaseSecurityMode } from '@/platform/runtime/runtime-capabilities';

import type { NativeProofReport } from './native-proof-runner';

type Props = Readonly<{
  schemaVersion: number;
  developmentRestartCount: number;
  databaseSecurityMode: DatabaseSecurityMode;
}>;
type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'passed'; report: NativeProofReport }
  | { status: 'failed'; message: string };

function allSecurityProofsPassed(report: NativeProofReport): boolean {
  return (
    report.wrongKeyRejected &&
    report.wrongPassphraseRejected &&
    report.corruptBackupRejected &&
    report.interruptedRestorePreservedLiveData
  );
}

export function Phase0HarnessScreen({
  schemaVersion,
  developmentRestartCount,
  databaseSecurityMode,
}: Props) {
  const { t, i18n } = useTranslation();
  const nativeSecurityAvailable = databaseSecurityMode === 'sqlcipher';
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [locale, setLocale] = useState<DeviceLocaleSnapshot>(() => readDeviceLocale());
  const [fileProof, setFileProof] = useState('Not run');
  const [pdfProof, setPdfProof] = useState('Not run');

  useEffect(() => observeDeviceLocale(setLocale), []);

  async function runProofs() {
    if (!nativeSecurityAvailable) return;
    setRunState({ status: 'running' });
    try {
      const { runNativePhase0Proofs } = await import('./native-proof-runner');
      const report = await runNativePhase0Proofs();
      if (!allSecurityProofsPassed(report))
        throw new Error('One or more failure-path proofs did not pass.');
      setRunState({ status: 'passed', report });
    } catch (error) {
      setRunState({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Native proof failed.',
      });
    }
  }

  async function switchLanguage(language: AppLanguage) {
    await setAppLanguage(language);
  }

  async function runPdfProof(interactive: 'none' | 'share' | 'print') {
    setPdfProof('Running…');
    const english = await createBilingualPdf('en');
    const hindi = await createBilingualPdf('hi');
    try {
      if (english.size <= 0 || hindi.size <= 0) throw new Error('Generated PDF is empty.');
      if (interactive === 'share') await sharePdf(hindi);
      if (interactive === 'print') await printPdf(hindi);
      setPdfProof(`Passed: EN ${english.size} bytes, HI ${hindi.size} bytes`);
    } catch (error) {
      setPdfProof(error instanceof Error ? `Failed: ${error.message}` : 'Failed');
    } finally {
      deleteTemporaryPdf(english);
      deleteTemporaryPdf(hindi);
    }
  }

  async function runPickerProof() {
    const selected = await pickGymVitoBackup();
    setFileProof(selected ? `Selected: ${selected.name}` : 'Picker cancelled safely');
  }

  const proofLabel =
    runState.status === 'passed'
      ? t('proofPassed')
      : runState.status === 'failed'
        ? `${t('proofFailed')}: ${runState.message}`
        : t('proofPending');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text testID="phase0-title" style={styles.title} maxFontSizeMultiplier={2}>
          {t('foundationTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('foundationSubtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('languageLabel')}</Text>
          <View style={styles.row}>
            {(['en', 'hi'] as const).map((language) => (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityState={{ selected: i18n.language === language }}
                onPress={() => void switchLanguage(language)}
                style={[styles.chip, i18n.language === language && styles.chipSelected]}
                testID={`language-${language}`}
              >
                <Text style={styles.chipText}>{language === 'en' ? t('english') : t('hindi')}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t(nativeSecurityAvailable ? 'encryptedDatabaseReady' : 'expoGoDatabaseReady')}
          </Text>
          <Text style={styles.detail}>
            Schema {schemaVersion} · {nativeSecurityAvailable ? 'SQLCipher' : 'Expo Go SQLite'}
          </Text>
          <Text testID="restart-proof" style={styles.detail}>
            Restart proof: {developmentRestartCount}
          </Text>
          <Text style={styles.detail}>
            {locale.locale} · {locale.timeZone} · {locale.calendar}
          </Text>
          {!nativeSecurityAvailable && (
            <Text style={styles.warning}>{t('expoGoSecurityNotice')}</Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={runState.status === 'running' || !nativeSecurityAvailable}
          onPress={() => void runProofs()}
          style={[styles.primaryButton, !nativeSecurityAvailable && styles.buttonDisabled]}
          testID="run-native-proofs"
        >
          {runState.status === 'running' ? (
            <ActivityIndicator color="#071a18" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('runProofs')}</Text>
          )}
        </Pressable>
        <Text testID="native-proof-status" style={styles.status} accessibilityLiveRegion="polite">
          {!nativeSecurityAvailable
            ? t('proofUnavailableInExpoGo')
            : runState.status === 'running'
              ? t('runningProofs')
              : proofLabel}
        </Text>

        {runState.status === 'passed' && (
          <View style={styles.reportCard} testID="native-proof-report">
            <Text style={styles.reportText}>Backup SHA-256: {runState.report.backupSha256}</Text>
            <Text style={styles.reportText}>
              10k avatars: {runState.report.avatarBenchmark.insertDurationMs} ms · list:{' '}
              {runState.report.avatarBenchmark.listReadDurationMs} ms
            </Text>
            <Text style={styles.reportText}>
              PIN Argon2id: {runState.report.pinKdfDurationMs} ms
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>PDF, sharing, printing</Text>
          <Text style={styles.detail}>{pdfProof}</Text>
          <View style={styles.wrapRow}>
            <Action label="Generate both" onPress={() => runPdfProof('none')} />
            <Action label="Share Hindi" onPress={() => runPdfProof('share')} />
            <Action label="Print Hindi" onPress={() => runPdfProof('print')} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Document picker</Text>
          <Text style={styles.detail}>{fileProof}</Text>
          <Action label="Select .gymvito file" onPress={runPickerProof} />
        </View>

        <Text style={styles.privacy}>{t('offlineNotice')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => Promise<void> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void onPress()}
      style={styles.secondaryButton}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#071a18' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, gap: 16 },
  title: {
    color: '#dff8ef',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 38,
    lineHeight: 52,
  },
  subtitle: {
    color: '#a7c9c0',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 18,
    lineHeight: 28,
  },
  card: { backgroundColor: '#102e29', padding: 18, borderRadius: 16, gap: 12 },
  cardTitle: {
    color: '#dff8ef',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 19,
  },
  detail: {
    color: '#a7c9c0',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 18 },
  chipSelected: { backgroundColor: '#36d2b4' },
  chipText: { color: '#eefbf7', fontFamily: 'NotoSansDevanagari_400Regular', fontSize: 16 },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    padding: 14,
    backgroundColor: '#36d2b4',
  },
  primaryButtonText: {
    color: '#071a18',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 18,
  },
  buttonDisabled: { opacity: 0.45 },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4b8f82',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: '#dff8ef', fontSize: 15 },
  status: { color: '#dff8ef', fontSize: 16 },
  reportCard: { borderLeftWidth: 3, borderLeftColor: '#36d2b4', paddingLeft: 14, gap: 7 },
  reportText: { color: '#a7c9c0', fontSize: 13 },
  warning: { color: '#ffd8a8', fontSize: 14, lineHeight: 20 },
  privacy: {
    color: '#7da69c',
    textAlign: 'center',
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    marginVertical: 10,
  },
});
