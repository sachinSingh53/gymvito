import { fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';

import { parseColor } from '@/ui/theme/contrast';
import { colors, glass } from '@/ui/theme/tokens';

import { AppButton, AppCheckbox, AppChoice, AppField, LoadingState, Notice } from './core-controls';

function backgrounds(screen: ReturnType<typeof render>) {
  return screen
    .UNSAFE_getAllByType(View)
    .map((view) => StyleSheet.flatten(view.props.style)?.backgroundColor)
    .filter(Boolean);
}

describe('AppButton', () => {
  it('keeps icon-only actions accessible and at least 48dp', () => {
    const onPress = jest.fn();
    const screen = render(
      <AppButton
        accessibilityLabel="Print receipt"
        icon={<Text>print-icon</Text>}
        iconOnly
        onPress={onPress}
        variant="secondary"
      />,
    );
    const button = screen.getByRole('button', { name: 'Print receipt' });

    expect(button).toHaveStyle({ minHeight: 48, width: 48 });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps every variant at least 48dp tall with its disabled state', () => {
    for (const variant of ['primary', 'secondary', 'danger', 'dangerTonal'] as const) {
      const screen = render(
        <AppButton disabled onPress={jest.fn()} variant={variant}>
          Save
        </AppButton>,
      );
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toHaveStyle({ minHeight: 48 });
      expect(button.props.accessibilityState).toEqual({ disabled: true });
      screen.unmount();
    }
  });
});

describe('AppButton glass styles', () => {
  it('keeps primary and danger solid with white labels, and never blurs', () => {
    const primary = render(<AppButton onPress={jest.fn()}>Save</AppButton>);
    const danger = render(
      <AppButton onPress={jest.fn()} variant="danger">
        Delete
      </AppButton>,
    );

    expect(primary.getByRole('button')).toHaveStyle({ backgroundColor: colors.primary });
    expect(primary.getByText('Save')).toHaveStyle({ color: colors.onPrimary });
    expect(danger.getByRole('button')).toHaveStyle({ backgroundColor: colors.danger });
    expect(primary.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
  });

  it('gives secondary and danger-tonal buttons a tinted fill and rim', () => {
    const secondary = render(
      <AppButton onPress={jest.fn()} variant="secondary">
        Cancel
      </AppButton>,
    );
    const tonal = render(
      <AppButton onPress={jest.fn()} variant="dangerTonal">
        Archive
      </AppButton>,
    );

    expect(secondary.getByRole('button')).toHaveStyle({
      borderColor: glass.rimAccent,
      backgroundColor: glass.fillAccent,
    });
    expect(secondary.getByText('Cancel')).toHaveStyle({ color: colors.primaryDark });
    expect(tonal.getByRole('button')).toHaveStyle({
      borderColor: glass.rimDanger,
      backgroundColor: glass.fillDanger,
    });
    expect(tonal.getByText('Archive')).toHaveStyle({ color: colors.dangerText });
  });
});

/** The bordered box a field's input sits in: the nearest ancestor that draws a rim. */
function fieldBox(input: ReturnType<ReturnType<typeof render>['getByLabelText']>) {
  let node = input.parent;
  while (node && !StyleSheet.flatten(node.props.style)?.borderColor) node = node.parent;
  if (!node) throw new Error('field box not found');
  return node;
}

describe('AppField', () => {
  it('uses a near-opaque fill and accent rim, and rings the focused field', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const screen = render(<AppField label="Phone" onBlur={onBlur} onFocus={onFocus} />);
    const input = screen.getByLabelText('Phone');

    expect(fieldBox(input)).toHaveStyle({
      minHeight: 60,
      borderColor: glass.rimAccent,
      backgroundColor: glass.fillOpaque,
    });
    fireEvent(input, 'focus');
    expect(fieldBox(screen.getByLabelText('Phone'))).toHaveStyle({ borderColor: colors.focus });
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent(input, 'blur');
    expect(fieldBox(screen.getByLabelText('Phone'))).toHaveStyle({
      borderColor: glass.rimAccent,
    });
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps the error border and alert while focused', () => {
    const screen = render(<AppField error="Required" label="Name" />);

    fireEvent(screen.getByLabelText('Name'), 'focus');
    expect(fieldBox(screen.getByLabelText('Name'))).toHaveStyle({ borderColor: colors.danger });
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('shows the label inside the box and fixed prefix and suffix text around the value', () => {
    const screen = render(<AppField label="Price" prefix="₹" suffix="/ month" value="1500" />);

    expect(screen.getByText('Price')).toBeTruthy();
    expect(screen.getByText('₹')).toBeTruthy();
    expect(screen.getByText('/ month')).toBeTruthy();
    expect(screen.getByLabelText('Price').props.value).toBe('1500');
  });
});

describe('AppChoice and AppCheckbox', () => {
  it('draws a radio or check indicator and tints the selected row, at least 48dp', () => {
    const screen = render(
      <>
        <AppChoice label="Monthly" onPress={jest.fn()} selected={false} />
        <AppChoice label="Yearly" onPress={jest.fn()} selected trailing="₹12,000" />
        <AppCheckbox label="Active" onPress={jest.fn()} selected />
      </>,
    );
    const [monthly, yearly] = screen.getAllByRole('radio');
    const checkbox = screen.getByRole('checkbox');

    expect(monthly).toHaveStyle({ minHeight: 52, backgroundColor: glass.fillOpaque });
    expect(yearly).toHaveStyle({
      minHeight: 52,
      borderColor: colors.primary,
      backgroundColor: glass.tintSelected,
    });
    expect(yearly.props.accessibilityState).toEqual({ selected: true });
    expect(yearly.props.accessibilityLabel).toBe('Yearly, ₹12,000');
    expect(screen.getByText('Yearly')).toHaveStyle({ color: colors.primaryDark });
    expect(checkbox).toHaveStyle({ backgroundColor: glass.tintSelected });
    expect(checkbox.props.accessibilityState).toEqual({ checked: true });
  });
});

describe('Notice', () => {
  it('renders a glass panel with a warning or danger tint at 0.85 alpha or more', () => {
    const warning = render(<Notice>Backup needed</Notice>);
    const danger = render(<Notice danger>Delete failed</Notice>);

    expect(warning.toJSON()).toHaveProp('accessibilityRole', 'summary');
    expect(warning.getByText('Backup needed')).toBeTruthy();
    expect(backgrounds(warning)).toContain(glass.tintWarning);
    expect(backgrounds(danger)).toContain(glass.tintDanger);
    expect(danger.getByText('Delete failed')).toHaveStyle({ color: colors.danger });
    for (const tint of [glass.tintWarning, glass.tintDanger]) {
      expect(parseColor(tint)[3]).toBeGreaterThanOrEqual(0.85);
    }
  });
});

describe('LoadingState', () => {
  it('centres the label inside a glass panel and keeps the live region', () => {
    const screen = render(<LoadingState label="Loading" />);

    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.toJSON()).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
  });
});
