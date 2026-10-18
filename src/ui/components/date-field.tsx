import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { type ComponentProps, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppField } from '@/ui/components/core-controls';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import { actionPressed, colors, radii, spacing } from '@/ui/theme/tokens';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Reads a `YYYY-MM-DD` string as local midnight, which is what the native picker works in. */
export function dateOnlyToLocalDate(value: string | undefined): Date | undefined {
  const match = value ? DATE_ONLY_PATTERN.exec(value) : null;
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function localDateToDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type DateFieldProps = Omit<
  ComponentProps<typeof AppField>,
  'accessory' | 'onChangeText' | 'value'
> & {
  value: string;
  onChangeText(value: string): void;
  /** Inclusive `YYYY-MM-DD` bounds for the calendar. Typed entry is still validated by the form. */
  minimumDate?: string;
  maximumDate?: string;
};

/**
 * Date-only text field with a calendar button. Typing `YYYY-MM-DD` still works; the button opens
 * the platform date picker and writes the chosen day back in the same format.
 */
export function AppDateField({
  value,
  onChangeText,
  minimumDate,
  maximumDate,
  label,
  ...fieldProps
}: DateFieldProps) {
  const { t } = useTranslation();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const min = dateOnlyToLocalDate(minimumDate);
  const max = dateOnlyToLocalDate(maximumDate);
  const pickerValue = clamp(dateOnlyToLocalDate(value) ?? new Date(), min, max);

  const choose = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) onChangeText(localDateToDateOnly(date));
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: choose,
      });
    } else {
      setIosPickerOpen((open) => !open);
    }
  };

  return (
    <View style={styles.group}>
      <AppField
        {...fieldProps}
        accessory={
          <Pressable
            accessibilityLabel={t('openCalendarFor', { field: label })}
            accessibilityRole="button"
            hitSlop={4}
            onPress={openPicker}
            style={({ pressed }) => [styles.calendarButton, pressed && actionPressed]}
          >
            <MaterialSymbol color={colors.primaryDark} name="calendar_month" size={22} />
          </Pressable>
        }
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        label={label}
        maxLength={10}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        value={value}
      />
      {Platform.OS !== 'android' && iosPickerOpen ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            accentColor={colors.primary}
            display="inline"
            maximumDate={max}
            minimumDate={min}
            mode="date"
            onChange={choose}
            textColor={colors.text}
            themeVariant="light"
            value={pickerValue}
          />
          <AppButton onPress={() => setIosPickerOpen(false)} variant="secondary">
            {t('done')}
          </AppButton>
        </View>
      ) : null}
    </View>
  );
}

function clamp(date: Date, min: Date | undefined, max: Date | undefined): Date {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

const styles = StyleSheet.create({
  group: { minWidth: 0, gap: spacing.sm },
  calendarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  iosPicker: { gap: spacing.sm },
});
