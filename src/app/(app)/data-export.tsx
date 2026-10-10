import type { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ExportDataset } from '@/data/repositories/phase6-repository';
import { useAppSession } from '@/features/session/app-session-context';
import {
  createTemporaryCsv,
  deleteTemporaryExport,
  shareTemporaryExport,
  type ExportProgress,
} from '@/platform/export/csv-export';
import { AppButton, AppField, Notice } from '@/ui/components/core-controls';
import { LocalDataBadge, OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

const EXPORTS: readonly {
  dataset: ExportDataset;
  label: 'exportMembers' | 'exportMemberships' | 'exportInvoices' | 'exportPayments';
}[] = [
  { dataset: 'members', label: 'exportMembers' },
  { dataset: 'memberships', label: 'exportMemberships' },
  { dataset: 'invoices', label: 'exportInvoices' },
  { dataset: 'payments', label: 'exportPayments' },
];

export default function DataExportRoute() {
  const { t } = useTranslation();
  const { state, getPhase6Repository, reauthenticateOwner } = useAppSession();
  const [ownerPin, setOwnerPin] = useState('');
  const [busy, setBusy] = useState<ExportDataset | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [message, setMessage] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') controllerRef.current?.abort();
    });
    return () => {
      subscription.remove();
      controllerRef.current?.abort();
    };
  }, []);
  if (state.status !== 'unlocked') return null;

  const runExport = async (dataset: ExportDataset) => {
    if (busy) return;
    if (!(await reauthenticateOwner(ownerPin))) {
      setMessage(t('ownerPinIncorrect'));
      return;
    }
    setBusy(dataset);
    setMessage('');
    setProgress(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    let file: File | null = null;
    try {
      const table = await getPhase6Repository().exportTable(dataset);
      file = await createTemporaryCsv(dataset, table, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      const shared = await shareTemporaryExport(
        file,
        t(EXPORTS.find((item) => item.dataset === dataset)!.label),
      );
      setMessage(shared ? t('exportReady') : t('exportUnavailable'));
      setOwnerPin('');
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'EXPORT_CANCELLED'
          ? t('exportCancelled')
          : t('exportFailed'),
      );
    } finally {
      if (file) deleteTemporaryExport(file);
      controllerRef.current = null;
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <OperationalShell
      active="more"
      backHref="/more"
      canGoBack
      subtitle={t('dataExportSubtitle')}
      title={t('dataExport')}
    >
      <View style={styles.page}>
        <LocalDataBadge />
        <Notice>{t('exportPrivacyWarning')}</Notice>
        <SurfaceCard style={styles.card}>
          <Text style={styles.title}>{t('authorizeExport')}</Text>
          <AppField
            label={t('exportOwnerPin')}
            keyboardType="number-pad"
            secureTextEntry
            value={ownerPin}
            onChangeText={setOwnerPin}
          />
          {EXPORTS.map((item) => (
            <AppButton
              key={item.dataset}
              disabled={!!busy || !ownerPin}
              variant={item.dataset === 'members' ? 'primary' : 'secondary'}
              onPress={() => void runExport(item.dataset)}
            >
              {busy === item.dataset
                ? t('exportPreparing', {
                    completed: progress?.completed ?? 0,
                    total: progress?.total ?? 0,
                  })
                : t(item.label)}
            </AppButton>
          ))}
          {busy ? (
            <AppButton variant="danger" onPress={() => controllerRef.current?.abort()}>
              {t('cancelExport')}
            </AppButton>
          ) : null}
        </SurfaceCard>
        {message ? (
          <Notice danger={message === t('ownerPinIncorrect') || message === t('exportFailed')}>
            {message}
          </Notice>
        ) : null}
      </View>
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  card: { gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
});
