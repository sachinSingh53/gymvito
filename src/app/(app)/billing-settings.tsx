import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BillingSettings } from '@/data/repositories/phase4-repository';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import { LocalDataBadge, OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

export default function BillingSettingsRoute() {
  const { t } = useTranslation();
  const { state, getPhase4Repository } = useAppSession();
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void getPhase4Repository()
      .getBillingSettings()
      .then((next) => active && setSettings(next))
      .catch(() => active && setMessage(t('billingSettingsLoadFailed')));
    return () => {
      active = false;
    };
  }, [getPhase4Repository, t]);
  if (state.status !== 'unlocked') return null;

  const save = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await getPhase4Repository().updateBillingSettings(settings, state.ownerId);
      setSettings(await getPhase4Repository().getBillingSettings());
      setMessage(t('billingSettingsSaved'));
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'INVALID_NUMBER_PREFIX'
          ? t('numberPrefixInvalid')
          : t('billingSettingsSaveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OperationalShell active="more" title={t('billingSettings')}>
      {!settings ? (
        <View style={styles.page}>
          <LocalDataBadge />
          {message ? <Notice danger>{message}</Notice> : <LoadingState label={t('loading')} />}
        </View>
      ) : (
        <View style={styles.page}>
          <LocalDataBadge />
          <Notice>{t('billingSettingsHistoryNotice')}</Notice>
          <SurfaceCard style={styles.section}>
            <Text style={styles.title}>{t('numberPrefixes')}</Text>
            <AppField
              label={t('invoicePrefix')}
              maxLength={8}
              onChangeText={(value) => setSettings({ ...settings, invoicePrefix: value })}
              value={settings.invoicePrefix}
            />
            <AppField
              label={t('receiptPrefix')}
              maxLength={8}
              onChangeText={(value) => setSettings({ ...settings, receiptPrefix: value })}
              value={settings.receiptPrefix}
            />
            <Text style={styles.hint}>{t('numberPrefixHint')}</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.section}>
            <Text style={styles.title}>{t('paymentMethodLabels')}</Text>
            {settings.paymentMethods.map((method, index) => (
              <View key={method.code} style={styles.methodRow}>
                <View style={styles.methodField}>
                  <AppField
                    label={t('paymentMethodCode', { code: method.code })}
                    maxLength={30}
                    onChangeText={(label) =>
                      setSettings({
                        ...settings,
                        paymentMethods: settings.paymentMethods.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label } : item,
                        ),
                      })
                    }
                    value={method.label}
                  />
                </View>
                <View style={styles.switchWrap}>
                  <Text style={styles.switchLabel}>{t('active')}</Text>
                  <Switch
                    accessibilityLabel={t('paymentMethodActive', { label: method.label })}
                    onValueChange={(isActive) =>
                      setSettings({
                        ...settings,
                        paymentMethods: settings.paymentMethods.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isActive } : item,
                        ),
                      })
                    }
                    trackColor={{ true: colors.primary }}
                    value={method.isActive}
                  />
                </View>
              </View>
            ))}
          </SurfaceCard>
          {message ? (
            <Notice danger={message !== t('billingSettingsSaved')}>{message}</Notice>
          ) : null}
          <AppButton disabled={saving} onPress={() => void save()}>
            {saving ? t('saving') : t('saveBillingSettings')}
          </AppButton>
        </View>
      )}
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodField: { minWidth: 0, flex: 1 },
  switchWrap: { minWidth: 76, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  switchLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
});
