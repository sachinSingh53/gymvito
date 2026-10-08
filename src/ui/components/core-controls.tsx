import type { ComponentProps, PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

type ButtonProps = PropsWithChildren<{
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}>;

export function AppButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
        {children}
      </Text>
    </Pressable>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
};

export function AppField({ label, error, hint, ...inputProps }: FieldProps) {
  const help = error ?? hint;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, inputProps.multiline && styles.multiline, error && styles.inputError]}
        {...inputProps}
      />
      {help ? (
        <Text
          accessibilityRole={error ? 'alert' : 'text'}
          style={error ? styles.error : styles.hint}
        >
          {help}
        </Text>
      ) : null}
    </View>
  );
}

type ChoiceProps = Readonly<{
  label: string;
  selected: boolean;
  onPress(): void;
}>;

export function AppChoice({ label, selected, onPress }: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function AppCheckbox({ label, selected, onPress }: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Notice({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  return (
    <View accessibilityRole="summary" style={[styles.notice, danger && styles.dangerNotice]}>
      <Text style={[styles.noticeText, danger && styles.dangerNoticeText]}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.loadingState}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 0,
    minHeight: 48,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
  },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  dangerButton: { backgroundColor: colors.danger },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
  buttonText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.onDark,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  secondaryButtonText: { color: colors.primary },
  fieldGroup: { minWidth: 0, gap: spacing.xs },
  label: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: '#ffffff',
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  multiline: { minHeight: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13 },
  choice: {
    minWidth: 0,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#ffffff',
  },
  choiceSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#dcf4ed' },
  choiceText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  choiceTextSelected: { color: colors.primary, fontFamily: fonts.semibold },
  notice: {
    minWidth: 0,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.warningSurface,
  },
  dangerNotice: { backgroundColor: '#fde7e7' },
  noticeText: {
    flexShrink: 1,
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  dangerNoticeText: { color: colors.danger },
  loadingState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
});
