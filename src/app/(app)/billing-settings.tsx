import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BillingSettings } from '@/data/repositories/phase4-repository';
import { useAppSession } from '@/features/session/app-session-context';
import { AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import { FormActions, FormRow, FormSection } from '@/ui/components/form-layout';
import { LocalDataBadge, OperationalShell } from '@/ui/components/operational-shell';
import { colors, fonts, glass, spacing } from '@/ui/theme/tokens';

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
    <OperationalShell active="more" backHref="/more" canGoBack title={t('billingSettings')}>
      {!settings ? (
        <View style={styles.page}>
          <LocalDataBadge />
          {message ? <Notice danger>{message}</Notice> : <LoadingState label={t('loading')} />}
        </View>
      ) : (
        <View style={styles.page}>
          <LocalDataBadge />
          <Notice>{t('billingSettingsHistoryNotice')}</Notice>
          <FormSection description={t('numberPrefixHint')} icon="tag" title={t('numberPrefixes')}>
            <FormRow>
              <AppField
                icon="description"
                label={t('invoicePrefix')}
                maxLength={8}
                onChangeText={(value) => setSettings({ ...settings, invoicePrefix: value })}
                value={settings.invoicePrefix}
              />
              <AppField
                icon="receipt_long"
                label={t('receiptPrefix')}
                maxLength={8}
                onChangeText={(value) => setSettings({ ...settings, receiptPrefix: value })}
                value={settings.receiptPrefix}
              />
            </FormRow>
          </FormSection>
          <FormSection icon="payments" title={t('paymentMethodLabels')}>
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
                    thumbColor={colors.surface}
                    trackColor={{ false: glass.rimPrimary, true: colors.primary }}
                    value={method.isActive}
                  />
                </View>
              </View>
            ))}
          </FormSection>
          {message ? (
            <Notice danger={message !== t('billingSettingsSaved')}>{message}</Notice>
          ) : null}
          <FormActions
            onPrimary={() => void save()}
            primaryDisabled={saving}
            primaryLabel={saving ? t('saving') : t('saveBillingSettings')}
          />
        </View>
      )}
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodField: { minWidth: 0, flex: 1 },
  switchWrap: {
    minWidth: 64,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  switchLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
});
