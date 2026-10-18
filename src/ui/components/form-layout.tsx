import { Children, type PropsWithChildren, type ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppButton, FieldFrame, FieldValue } from '@/ui/components/core-controls';
import { FilterSheet, SheetOption } from '@/ui/components/filter-controls';
import { MaterialSymbol, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

type SectionProps = PropsWithChildren<{
  title: string;
  /** Material Symbol shown in the header bubble. */
  icon: string;
  description?: string;
  /** Right side of the header, e.g. a status chip. */
  trailing?: ReactNode;
  /**
   * Header and body without a glass card, for forms that already sit inside a panel such as
   * `AppScreen`. Consecutive plain sections are split by a divider.
   */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** A titled group of fields. */
export function FormSection({
  title,
  icon,
  description,
  trailing,
  plain = false,
  style,
  children,
}: SectionProps) {
  const header = (
    <View style={styles.header}>
      <View style={styles.iconBubble}>
        <MaterialSymbol color={colors.primaryDark} name={icon} size={22} />
      </View>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {trailing}
    </View>
  );
  if (plain) {
    return (
      <View style={[styles.section, styles.plainSection, style]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <SurfaceCard style={[styles.section, style]}>
      {header}
      {children}
    </SurfaceCard>
  );
}

/**
 * Lays fields side by side while each can keep `minItemWidth`, and stacks them on narrow
 * screens.
 */
export function FormRow({
  children,
  minItemWidth = 150,
}: PropsWithChildren<{ minItemWidth?: number }>) {
  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={[styles.rowItem, { flexBasis: minItemWidth }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Small caption above a group of controls that has no field box of its own. */
export function FormLabel({ children }: PropsWithChildren) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

type SegmentOption<T extends string | number> = Readonly<{ value: T; label: string }>;

/** Single-choice control for two to four short options. */
export function AppSegmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: NoInfer<T>): void;
}) {
  return (
    <View style={styles.segmentedGroup}>
      {label ? <FormLabel>{label}</FormLabel> : null}
      <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.track}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                selected && styles.segmentSelected,
                pressed && !selected && styles.segmentPressed,
              ]}
            >
              <Text
                numberOfLines={2}
                style={[styles.segmentText, selected && styles.segmentTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SelectOption<T extends string> = Readonly<{ value: T; label: string }>;

/**
 * Dropdown field: looks like a text field and opens a bottom sheet of options. Use it for
 * single choices with more options than fit a segmented control, or labels that are too long.
 */
export function AppSelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  icon,
  error,
  hint,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange(value: NoInfer<T>): void;
  /** Shown, muted, while no option matches `value`. */
  placeholder?: string;
  icon?: string;
  error?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const shown = current?.label ?? placeholder ?? '';
  return (
    <>
      <FieldFrame
        accessory={
          <View style={styles.selectChevron}>
            <MaterialSymbol
              color={open ? colors.primary : colors.textMuted}
              name="expand_more"
              size={24}
            />
          </View>
        }
        active={open}
        error={error}
        hint={hint}
        icon={icon}
        label={label}
        onPress={() => setOpen(true)}
        pressableProps={{
          accessibilityHint: error ?? hint,
          accessibilityLabel: `${label}: ${shown}`,
          accessibilityRole: 'button',
          accessibilityState: { expanded: open },
        }}
      >
        <FieldValue muted={!current}>{shown}</FieldValue>
      </FieldFrame>
      <FilterSheet onClose={() => setOpen(false)} title={label} visible={open}>
        {options.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            selected={option.value === value}
          />
        ))}
      </FilterSheet>
    </>
  );
}

/** A setting with a title, optional explanation and a switch. The whole row toggles it. */
export function AppSwitchRow({
  label,
  description,
  icon,
  value,
  onValueChange,
  children,
}: PropsWithChildren<{
  label: string;
  description?: string;
  icon?: string;
  value: boolean;
  onValueChange(value: boolean): void;
}>) {
  return (
    <View style={[styles.switchCard, value && styles.switchCardOn]}>
      <Pressable
        accessible={false}
        onPress={() => onValueChange(!value)}
        style={({ pressed }) => [styles.switchRow, pressed && styles.switchRowPressed]}
      >
        {icon ? (
          <MaterialSymbol color={value ? colors.primary : colors.textMuted} name={icon} size={22} />
        ) : null}
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>{label}</Text>
          {description ? <Text style={styles.switchDescription}>{description}</Text> : null}
        </View>
        <Switch
          accessibilityLabel={label}
          ios_backgroundColor={glass.rimAccent}
          onValueChange={onValueChange}
          thumbColor={colors.surface}
          trackColor={{ false: glass.rimPrimary, true: colors.primary }}
          value={value}
        />
      </Pressable>
      {value && children ? <View style={styles.switchBody}>{children}</View> : null}
    </View>
  );
}

/** Save and cancel, side by side; the primary action takes the larger share. */
export function FormActions({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryIcon = 'save',
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  onPrimary(): void;
  primaryDisabled?: boolean;
  primaryIcon?: string;
  secondaryLabel?: string;
  onSecondary?(): void;
}) {
  return (
    <View style={styles.actions}>
      <AppButton
        disabled={primaryDisabled}
        icon={<MaterialSymbol color={colors.onPrimary} name={primaryIcon} size={20} />}
        onPress={onPrimary}
        style={styles.primaryAction}
      >
        {primaryLabel}
      </AppButton>
      {secondaryLabel && onSecondary ? (
        <AppButton onPress={onSecondary} style={styles.secondaryAction} variant="secondary">
          {secondaryLabel}
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  plainSection: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
  },
  header: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: 14,
    backgroundColor: glass.fillAccent,
  },
  headerCopy: { minWidth: 0, flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  row: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowItem: { minWidth: 0, flexGrow: 1, flexShrink: 1 },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    paddingLeft: 4,
  },
  segmentedGroup: { minWidth: 0, gap: 6 },
  track: {
    minWidth: 0,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.lg + 2,
    backgroundColor: glass.segmentTrack,
  },
  segment: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 13,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentPressed: { backgroundColor: glass.fillAccent },
  segmentText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  segmentTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  selectChevron: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  switchCard: {
    minWidth: 0,
    borderWidth: 1.5,
    borderColor: glass.rimAccent,
    borderRadius: radii.lg,
    backgroundColor: glass.fillOpaque,
    overflow: 'hidden',
  },
  switchCardOn: { borderColor: glass.rimPrimary },
  switchRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchRowPressed: { backgroundColor: glass.fillAccent },
  switchCopy: { minWidth: 0, flex: 1, gap: 2 },
  switchTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  switchDescription: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  switchBody: {
    gap: spacing.md,
    padding: 14,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
  },
  actions: {
    minWidth: 0,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  primaryAction: { flexGrow: 2, flexBasis: 180 },
  secondaryAction: { flexGrow: 1, flexBasis: 110 },
});
