import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { GymSetupInput } from '@/domain/onboarding/onboarding';
import { AppChoice, AppField } from '@/ui/components/core-controls';
import { AppSegmented, FormLabel, FormRow, FormSection } from '@/ui/components/form-layout';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

const DATE_FORMATS = ['day-month-year', 'month-day-year', 'year-month-day'] as const;

/** Gym profile and regional settings, shared by first-run setup and the settings screen. */
export function GymProfileFields({
  form,
  errors,
  onChange,
}: {
  form: GymSetupInput;
  errors: Record<string, string>;
  onChange<K extends keyof GymSetupInput>(key: K, value: GymSetupInput[K]): void;
}) {
  const { t } = useTranslation();
  const errorFor = (key: string) => (errors[key] ? t('fieldInvalid') : undefined);
  return (
    <>
      <FormSection icon="storefront" plain style={styles.firstSection} title={t('gymDetails')}>
        <AppField
          autoCapitalize="words"
          error={errorFor('gymName')}
          icon="fitness_center"
          label={t('gymName')}
          onChangeText={(value) => onChange('gymName', value)}
          value={form.gymName}
        />
        <AppField
          autoCapitalize="words"
          error={errorFor('ownerName')}
          icon="person"
          label={t('ownerName')}
          onChangeText={(value) => onChange('ownerName', value)}
          value={form.ownerName}
        />
        <FormRow minItemWidth={220}>
          <AppField
            icon="call"
            keyboardType="phone-pad"
            label={t('phoneOptional')}
            onChangeText={(value) => onChange('phone', value)}
            value={form.phone}
          />
          <AppField
            autoCapitalize="none"
            error={errorFor('email')}
            icon="mail"
            keyboardType="email-address"
            label={t('emailOptional')}
            onChangeText={(value) => onChange('email', value)}
            value={form.email}
          />
        </FormRow>
        <AppField
          icon="home"
          label={t('addressOptional')}
          multiline
          onChangeText={(value) => onChange('address', value)}
          value={form.address}
        />
        <AppField
          icon="receipt_long"
          label={t('receiptFooterOptional')}
          onChangeText={(value) => onChange('receiptFooter', value)}
          value={form.receiptFooter}
        />
      </FormSection>
      <FormSection icon="language" plain title={t('regionalSettings')}>
        <AppField
          autoCapitalize="characters"
          error={errorFor('currencyCode')}
          icon="payments"
          label={t('currencyCode')}
          maxLength={3}
          onChangeText={(value) => onChange('currencyCode', value.toUpperCase())}
          value={form.currencyCode}
        />
        <View style={styles.group}>
          <FormLabel>{t('dateFormat')}</FormLabel>
          <View accessibilityRole="radiogroup" style={styles.group}>
            {DATE_FORMATS.map((value) => (
              <AppChoice
                key={value}
                label={t(value)}
                onPress={() => onChange('dateFormat', value)}
                selected={form.dateFormat === value}
              />
            ))}
          </View>
        </View>
        <FormRow minItemWidth={220}>
          <AppSegmented
            label={t('timeFormat')}
            onChange={(value) => onChange('timeFormat', value)}
            options={[
              { value: '12-hour', label: t('time12') },
              { value: '24-hour', label: t('time24') },
            ]}
            value={form.timeFormat}
          />
          <AppSegmented
            label={t('weekStartsOn')}
            onChange={(value) => onChange('weekStartsOn', value)}
            options={[
              { value: 1, label: t('monday') },
              { value: 0, label: t('sunday') },
            ]}
            value={form.weekStartsOn}
          />
        </FormRow>
        <FormRow minItemWidth={130}>
          <AppField
            error={errorFor('financialYearStartMonth')}
            keyboardType="number-pad"
            label={t('financialYearMonth')}
            onChangeText={(value) => onChange('financialYearStartMonth', Number(value))}
            value={String(form.financialYearStartMonth)}
          />
          <AppField
            error={errorFor('financialYearStartDay')}
            keyboardType="number-pad"
            label={t('financialYearDay')}
            onChangeText={(value) => onChange('financialYearStartDay', Number(value))}
            value={String(form.financialYearStartDay)}
          />
        </FormRow>
        <View style={styles.hintRow}>
          <MaterialSymbol color={colors.textMuted} name="schedule" size={18} />
          <Text style={styles.hint}>{t('deviceTimezoneNotice')}</Text>
        </View>
      </FormSection>
    </>
  );
}

const styles = StyleSheet.create({
  firstSection: { paddingTop: 0, borderTopWidth: 0 },
  group: { gap: spacing.sm },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  hint: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
