import { type PropsWithChildren, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/ui/components/core-controls';
import { AppDateField } from '@/ui/components/date-field';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import { actionPressed, colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

/** Visible chip height; `hitSlop` lifts the touch target to the 48dp minimum. */
const CHIP_HEIGHT = 40;
const CHIP_HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

/** One horizontally scrolling row of filter chips. Every screen's filters live in one of these. */
export function FilterBar({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={styles.bar}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={styles.barScroll}
    >
      {children}
    </ScrollView>
  );
}

type FilterChipProps = Readonly<{
  label: string;
  selected: boolean;
  onPress(): void;
  /** Leading symbol; `color` is used while unselected. */
  icon?: { name: string; color?: string };
  count?: number;
  /**
   * `toggle` picks a value in place, `picker` opens a sheet of options (shows a chevron), and
   * `action` runs a one-off command such as resetting the filters.
   */
  kind?: 'toggle' | 'picker' | 'action';
  accessibilityLabel?: string;
}>;

export function FilterChip({
  label,
  selected,
  onPress,
  icon,
  count,
  kind = 'toggle',
  accessibilityLabel,
}: FilterChipProps) {
  const foreground = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={kind === 'toggle' ? 'radio' : 'button'}
      accessibilityState={kind === 'toggle' ? { selected } : undefined}
      hitSlop={CHIP_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && actionPressed,
      ]}
    >
      {icon ? (
        <MaterialSymbol
          color={selected ? colors.onPrimary : (icon.color ?? colors.primaryDark)}
          name={icon.name}
          size={16}
        />
      ) : null}
      <Text numberOfLines={1} style={[styles.chipText, { color: foreground }]}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text style={[styles.count, selected && styles.countSelected]}>{count}</Text>
      ) : null}
      {kind === 'picker' ? (
        <MaterialSymbol color={foreground} name="expand_more" size={18} />
      ) : null}
    </Pressable>
  );
}

/** Bottom sheet that holds a filter's options. */
export function FilterSheet({
  title,
  visible,
  onClose,
  children,
}: PropsWithChildren<{ title: string; visible: boolean; onClose(): void }>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityLabel={t('close')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel={t('close')}
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && actionPressed]}
            >
              <MaterialSymbol color={colors.textMuted} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** One choice in a `FilterSheet`; selected options show a check. */
export function SheetOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && actionPressed,
      ]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected ? <MaterialSymbol color={colors.primary} name="check" size={22} /> : null}
    </Pressable>
  );
}

export type FilterOption<T> = Readonly<{ value: T; label: string }>;

/**
 * Chip showing the current choice of one filter; tapping it opens a sheet of the options.
 * The chip fills in while the value differs from `defaultValue`, so narrowed filters stand out.
 */
export function FilterSelect<T>({
  title,
  value,
  defaultValue,
  options,
  onChange,
  icon,
}: {
  title: string;
  value: T;
  defaultValue: T;
  options: readonly FilterOption<T>[];
  onChange(value: T): void;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <>
      <FilterChip
        accessibilityLabel={`${title}: ${current?.label ?? ''}`}
        icon={icon ? { name: icon } : undefined}
        label={current?.label ?? title}
        onPress={() => setOpen(true)}
        kind="picker"
        selected={value !== defaultValue}
      />
      <FilterSheet onClose={() => setOpen(false)} title={title} visible={open}>
        {options.map((option) => (
          <SheetOption
            key={String(option.value)}
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

export type DateRangePreset = Readonly<{ key: string; label: string; from: string; to: string }>;

/**
 * Date range chip. The sheet offers quick presets and a custom from/to pair; the chip names
 * the matching preset, or shows `rangeLabel` for a custom range.
 */
export function DateRangeFilter({
  title,
  from,
  to,
  presets,
  defaultPresetKey,
  rangeLabel,
  fromLabel,
  toLabel,
  onChange,
}: {
  title: string;
  from: string;
  to: string;
  presets: readonly DateRangePreset[];
  defaultPresetKey: string;
  rangeLabel: string;
  fromLabel: string;
  toLabel: string;
  onChange(from: string, to: string): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const preset = presets.find((item) => item.from === from && item.to === to);
  return (
    <>
      <FilterChip
        accessibilityLabel={`${title}: ${preset?.label ?? rangeLabel}`}
        icon={{ name: 'calendar_month' }}
        label={preset?.label ?? rangeLabel}
        onPress={() => setOpen(true)}
        kind="picker"
        selected={preset?.key !== defaultPresetKey}
      />
      <FilterSheet onClose={() => setOpen(false)} title={title} visible={open}>
        {presets.map((item) => (
          <SheetOption
            key={item.key}
            label={item.label}
            onPress={() => {
              onChange(item.from, item.to);
              setOpen(false);
            }}
            selected={preset?.key === item.key}
          />
        ))}
        <Text style={styles.sheetSection}>{t('customRange')}</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <AppDateField
              label={fromLabel}
              maximumDate={to}
              onChangeText={(value) => onChange(value, to)}
              value={from}
            />
          </View>
          <View style={styles.dateField}>
            <AppDateField
              label={toLabel}
              minimumDate={from}
              onChangeText={(value) => onChange(from, value)}
              value={to}
            />
          </View>
        </View>
        <AppButton onPress={() => setOpen(false)}>{t('done')}</AppButton>
      </FilterSheet>
    </>
  );
}

const styles = StyleSheet.create({
  barScroll: { flexGrow: 0, flexShrink: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  chip: {
    minHeight: CHIP_HEIGHT,
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillAccent,
  },
  chipSelected: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  chipText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14 },
  count: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    color: colors.text,
    backgroundColor: glass.fillOpaque,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  countSelected: { color: colors.onPrimary, backgroundColor: glass.fillOnPrimary },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7, 26, 24, 0.32)',
  },
  sheet: {
    maxHeight: '80%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: colors.surface,
    shadowColor: colors.brandHeader,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 12,
  },
  grabber: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  sheetBody: { gap: spacing.xs, paddingBottom: spacing.sm },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  optionSelected: { backgroundColor: glass.fillAccent },
  optionText: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  optionTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  sheetSection: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateField: { minWidth: 140, flex: 1 },
});
