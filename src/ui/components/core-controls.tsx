import {
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import {
  CARD_RADIUS,
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
      accessibilityLabel={
        accessibilityLabel ?? (icon && typeof children === 'string' ? children : undefined)
      }
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        variant === 'dangerTonal' && styles.dangerTonalButton,
        iconOnly && styles.iconOnlyButton,
        style,
        pressed && actionPressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.buttonContent}>
        {icon}
        {children ? (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            numberOfLines={1}
            style={[
              styles.buttonText,
              variant === 'secondary' && styles.secondaryButtonText,
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
  /** Material Symbol drawn at the field's leading edge, e.g. `call` or `mail`. */
  icon?: string;
  /** Fixed text before the value, e.g. a currency symbol. */
  prefix?: string;
  /** Fixed text after the value, e.g. `%` or `days`. */
  suffix?: string;
  /** Trailing control drawn inside the field's right edge, e.g. a calendar button. */
  accessory?: ReactNode;
};

/**
 * Text field with its label set inside the box. Tapping anywhere on the box focuses the input,
 * and the focused box gets a soft halo as well as the focus rim.
 */
export function AppField({
  label,
  error,
  hint,
  icon,
  prefix,
  suffix,
  accessory,
  ...inputProps
}: FieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <FieldFrame
      accessory={accessory}
      active={focused}
      disabled={inputProps.editable === false}
      error={error}
      hint={hint}
      icon={icon}
      label={label}
      multiline={inputProps.multiline}
      onPress={() => inputRef.current?.focus()}
      pressableProps={{ accessible: false }}
    >
      {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        cursorColor={colors.primary}
        placeholderTextColor={glass.placeholder}
        selectionColor={glass.selection}
        {...inputProps}
        style={[styles.input, inputProps.multiline && styles.inputMultiline]}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
      />
      {suffix ? <Text style={[styles.affix, styles.suffix]}>{suffix}</Text> : null}
    </FieldFrame>
  );
}

/** The value inside a `FieldFrame` that is not a text input, e.g. a select's current choice. */
export function FieldValue({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return (
    <Text numberOfLines={1} style={[styles.input, styles.fieldValue, muted && styles.valueMuted]}>
      {children}
    </Text>
  );
}

type FieldFrameProps = PropsWithChildren<{
  label: string;
  error?: string;
  hint?: string;
  icon?: string;
  accessory?: ReactNode;
  /** Focused input, or an open picker. */
  active: boolean;
  multiline?: boolean;
  disabled?: boolean;
  onPress(): void;
  pressableProps?: Omit<PressableProps, 'children' | 'disabled' | 'onPress' | 'style'>;
}>;

/**
 * The box shared by every field: inset label, optional leading icon, focus halo, error rim and
 * the hint or error line below. `children` is the value row.
 */
export function FieldFrame({
  label,
  error,
  hint,
  icon,
  accessory,
  active,
  multiline = false,
  disabled = false,
  onPress,
  pressableProps,
  children,
}: FieldFrameProps) {
  const help = error ?? hint;
  return (
    <View style={styles.fieldGroup}>
      <Pressable
        {...pressableProps}
        disabled={disabled}
        onPress={onPress}
        style={[styles.fieldHalo, active && !error && styles.fieldHaloFocused]}
      >
        <View
          style={[
            styles.fieldBox,
            multiline && styles.fieldBoxMultiline,
            active && styles.fieldBoxFocused,
            error ? styles.fieldBoxError : null,
            disabled && styles.fieldBoxReadOnly,
          ]}
        >
          {icon ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <MaterialSymbol
                color={error ? colors.danger : active ? colors.primary : colors.textMuted}
                name={icon}
                size={22}
              />
            </View>
          ) : null}
          <View style={styles.fieldBody}>
            <Text
              numberOfLines={1}
              style={[
                styles.fieldLabel,
                active && styles.fieldLabelFocused,
                error ? styles.fieldLabelError : null,
              ]}
            >
              {label}
            </Text>
            <View style={styles.inputRow}>{children}</View>
          </View>
          {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
        </View>
      </Pressable>
      {help ? (
        <View style={styles.helpRow}>
          {error ? <MaterialSymbol color={colors.danger} name="error" size={16} /> : null}
          <Text
            accessibilityRole={error ? 'alert' : 'text'}
            style={error ? styles.error : styles.hint}
          >
            {help}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type ChoiceProps = Readonly<{
  label: string;
  selected: boolean;
  onPress(): void;
  /** Secondary line under the label. */
  description?: string;
  /** Right-aligned value, e.g. a price. */
  trailing?: string;
}>;

function ChoiceRow({
  label,
  selected,
  onPress,
  description,
  trailing,
  kind,
}: ChoiceProps & { kind: 'radio' | 'checkbox' }) {
  return (
    <Pressable
      accessibilityLabel={trailing ? `${label}, ${trailing}` : undefined}
      accessibilityRole={kind}
      accessibilityState={kind === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && actionPressed,
      ]}
    >
      {kind === 'radio' ? (
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? <MaterialSymbol color={colors.onPrimary} name="check" size={16} /> : null}
        </View>
      )}
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
        {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
      </View>
      {trailing ? (
        <Text style={[styles.choiceTrailing, selected && styles.choiceTextSelected]}>
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function AppChoice(props: ChoiceProps) {
  return <ChoiceRow {...props} kind="radio" />;
}

export function AppCheckbox(props: ChoiceProps) {
  return <ChoiceRow {...props} kind="checkbox" />;
}

export function Notice({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  return (
    <View accessibilityRole="summary" style={styles.frame}>
      <GlassSurface
        radius={CARD_RADIUS}
        style={[styles.notice, danger && styles.dangerNotice]}
        tint={danger ? glass.tintDanger : glass.tintWarning}
      >
        <MaterialSymbol
          color={danger ? colors.danger : colors.warningText}
          name={danger ? 'error' : 'info'}
          size={20}
        />
        <Text style={[styles.noticeText, danger && styles.dangerNoticeText]}>{children}</Text>
      </GlassSurface>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.frame}>
      <GlassSurface radius={CARD_RADIUS} style={styles.loadingState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>{label}</Text>
      </GlassSurface>
    </View>
  );
}

/** Halo drawn around a focused field; sits outside the box so the box keeps its size. */
const HALO = 3;

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
  secondaryButton: {
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  dangerButton: { backgroundColor: colors.danger },
  dangerTonalButton: {
    borderWidth: 1,
    borderColor: glass.rimDanger,
    backgroundColor: glass.fillDanger,
  },
  iconOnlyButton: { width: 48, paddingHorizontal: 0, paddingVertical: 0 },
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
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  secondaryButtonText: { color: colors.primaryDark },
  dangerTonalButtonText: { color: colors.dangerText },
  fieldGroup: { minWidth: 0, gap: 6 },
  fieldHalo: {
    margin: -HALO,
    borderWidth: HALO,
    borderColor: 'transparent',
    borderRadius: radii.lg + HALO,
  },
  fieldHaloFocused: { borderColor: glass.focusHalo },
  fieldBox: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: glass.rimAccent,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    backgroundColor: glass.fillOpaque,
  },
  fieldBoxMultiline: { alignItems: 'flex-start' },
  fieldBoxFocused: { borderColor: colors.focus, backgroundColor: colors.surface },
  fieldBoxError: { borderColor: colors.danger, backgroundColor: glass.fillDangerSoft },
  fieldBoxReadOnly: { borderStyle: 'dashed', backgroundColor: glass.fillAccent },
  fieldBody: { minWidth: 0, flex: 1, gap: 2 },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  fieldLabelFocused: { color: colors.primary },
  fieldLabelError: { color: colors.danger },
  inputRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    minWidth: 0,
    flex: 1,
    minHeight: 26,
    margin: 0,
    padding: 0,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  inputMultiline: { minHeight: 66, textAlignVertical: 'top' },
  fieldValue: { minHeight: 0, paddingVertical: 2 },
  valueMuted: { color: glass.placeholder },
  affix: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  suffix: { color: colors.textMuted },
  accessory: { marginRight: -spacing.xs },
  helpRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingLeft: 4 },
  hint: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  error: {
    minWidth: 0,
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  choice: {
    minWidth: 0,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: glass.rimAccent,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: glass.fillOpaque,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: glass.tintSelected },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outline,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outline,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceCopy: { minWidth: 0, flex: 1, gap: 2 },
  choiceText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  choiceTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  choiceDescription: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  choiceTrailing: {
    flexShrink: 0,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  frame: { minWidth: 0 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderColor: glass.rimWarning,
  },
  dangerNotice: { borderColor: glass.rimDanger },
  noticeText: {
    minWidth: 0,
    flex: 1,
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
    padding: spacing.md,
  },
  loadingText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
});
