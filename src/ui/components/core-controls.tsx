import { type ComponentProps, type PropsWithChildren, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GlassSurface } from '@/ui/components/glass-surface';
import {
  CARD_RADIUS,
  GLASS_UI,
  actionPressed,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

type ButtonProps = PropsWithChildren<{
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerTonal';
  accessibilityLabel?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function AppButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  icon,
  iconOnly = false,
  style,
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
        variant === 'secondary' &&
          (GLASS_UI ? styles.glassSecondaryButton : styles.secondaryButton),
        variant === 'danger' && styles.dangerButton,
        variant === 'dangerTonal' &&
          (GLASS_UI ? styles.glassDangerTonalButton : styles.dangerTonalButton),
        iconOnly && styles.iconOnlyButton,
        style,
        pressed && (GLASS_UI ? actionPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.buttonContent}>
        {icon}
        {children ? (
          <Text
            style={[
              styles.buttonText,
              GLASS_UI && styles.glassButtonText,
              variant === 'secondary' &&
                (GLASS_UI ? styles.glassSecondaryButtonText : styles.secondaryButtonText),
              variant === 'dangerTonal' && styles.dangerTonalButtonText,
            ]}
          >
            {children}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
};

export function AppField({ label, error, hint, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const help = error ?? hint;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          GLASS_UI && styles.glassInput,
          GLASS_UI && focused && styles.glassInputFocused,
          inputProps.multiline && styles.multiline,
          error && styles.inputError,
        ]}
        {...inputProps}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
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

function choiceStyle(selected: boolean, pressed: boolean): StyleProp<ViewStyle> {
  if (GLASS_UI) {
    return [
      styles.choice,
      styles.glassChoice,
      selected && styles.glassChoiceSelected,
      pressed && actionPressed,
    ];
  }
  return [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed];
}

function choiceTextStyle(selected: boolean) {
  return [
    styles.choiceText,
    selected && styles.choiceTextSelected,
    GLASS_UI && selected && styles.glassChoiceTextSelected,
  ];
}

export function AppChoice({ label, selected, onPress }: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => choiceStyle(selected, pressed)}
    >
      <Text style={choiceTextStyle(selected)}>{label}</Text>
    </Pressable>
  );
}

export function AppCheckbox({ label, selected, onPress }: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => choiceStyle(selected, pressed)}
    >
      <Text style={choiceTextStyle(selected)}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Notice({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  if (GLASS_UI) {
    return (
      <View accessibilityRole="summary" style={styles.glassFrame}>
        <GlassSurface
          radius={CARD_RADIUS}
          style={[styles.glassNotice, danger && styles.glassDangerNotice]}
          tint={danger ? glass.tintDanger : glass.tintWarning}
        >
          <Text style={[styles.noticeText, danger && styles.dangerNoticeText]}>{children}</Text>
        </GlassSurface>
      </View>
    );
  }
  return (
    <View accessibilityRole="summary" style={[styles.notice, danger && styles.dangerNotice]}>
      <Text style={[styles.noticeText, danger && styles.dangerNoticeText]}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  if (GLASS_UI) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.glassFrame}>
        <GlassSurface radius={CARD_RADIUS} style={[styles.loadingState, styles.glassLoadingState]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{label}</Text>
        </GlassSurface>
      </View>
    );
  }
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
  dangerTonalButton: {
    borderWidth: 1,
    borderColor: '#f5bebe',
    backgroundColor: colors.dangerSurface,
  },
  iconOnlyButton: { width: 48, paddingHorizontal: 0, paddingVertical: 0 },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
  buttonContent: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
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
  glassSecondaryButton: {
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  glassDangerTonalButton: {
    borderWidth: 1,
    borderColor: glass.rimDanger,
    backgroundColor: glass.fillDanger,
  },
  glassButtonText: { color: colors.onPrimary },
  glassSecondaryButtonText: { color: colors.primaryDark },
  dangerTonalButtonText: { color: colors.dangerText },
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
  glassInput: {
    borderColor: glass.rimAccent,
    borderRadius: radii.lg,
    backgroundColor: glass.fillOpaque,
  },
  glassInputFocused: {
    borderWidth: 2,
    borderColor: colors.focus,
    paddingHorizontal: spacing.md - 1,
  },
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
  glassChoice: {
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillAccent,
  },
  glassChoiceSelected: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  glassChoiceTextSelected: { color: colors.onPrimary },
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
  glassFrame: { minWidth: 0 },
  glassNotice: { padding: spacing.md, borderColor: glass.rimWarning },
  glassDangerNotice: { borderColor: glass.rimDanger },
  loadingState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  glassLoadingState: { padding: spacing.md },
  loadingText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
});
