import { fireEvent, render } from '@testing-library/react-native';

import '@/i18n';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors } from '@/ui/theme/tokens';

import {
  AppSegmented,
  AppSelectField,
  AppSwitchRow,
  FormActions,
  FormSection,
} from './form-layout';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('FormSection', () => {
  it('gives the section a header so screen readers can jump between groups', () => {
    const screen = render(
      <FormSection description="Shown on receipts" icon="storefront" title="Gym details">
        <Text>Body</Text>
      </FormSection>,
    );

    expect(screen.getByRole('header', { name: 'Gym details' })).toBeTruthy();
    expect(screen.getByText('Shown on receipts')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });
});

describe('AppSegmented', () => {
  function Harness() {
    const [value, setValue] = useState<'day' | 'month'>('day');
    return (
      <AppSegmented
        label="Unit"
        onChange={setValue}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'month', label: 'Month' },
        ]}
        value={value}
      />
    );
  }

  it('is a labelled radio group of 48dp options that moves the selection', () => {
    const screen = render(<Harness />);
    const day = screen.getByRole('radio', { name: 'Day' });
    const month = screen.getByRole('radio', { name: 'Month' });

    expect(screen.getByLabelText('Unit').props.accessibilityRole).toBe('radiogroup');
    expect(StyleSheet.flatten(day.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(day.props.accessibilityState).toEqual({ selected: true });

    fireEvent.press(month);
    expect(screen.getByRole('radio', { name: 'Month' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByText('Month')).toHaveStyle({ color: colors.primaryDark });
  });
});

describe('AppSwitchRow', () => {
  it('toggles from the switch or the row, and shows its body only while on', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <AppSwitchRow label="Allow freeze" onValueChange={onValueChange} value={false}>
        <Text>Freeze days</Text>
      </AppSwitchRow>,
    );

    expect(screen.queryByText('Freeze days')).toBeNull();
    fireEvent(screen.getByLabelText('Allow freeze'), 'valueChange', true);
    fireEvent.press(screen.getByText('Allow freeze'));
    expect(onValueChange.mock.calls).toEqual([[true], [true]]);

    screen.rerender(
      <AppSwitchRow label="Allow freeze" onValueChange={onValueChange} value>
        <Text>Freeze days</Text>
      </AppSwitchRow>,
    );
    expect(screen.getByText('Freeze days')).toBeTruthy();
  });
});

describe('FormActions', () => {
  it('names the primary button by its label, not its icon glyph', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const screen = render(
      <FormActions
        onPrimary={onPrimary}
        onSecondary={onSecondary}
        primaryLabel="Save plan"
        secondaryLabel="Cancel"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('disables only the primary action', () => {
    const screen = render(
      <FormActions
        onPrimary={jest.fn()}
        onSecondary={jest.fn()}
        primaryDisabled
        primaryLabel="Saving…"
        secondaryLabel="Cancel"
      />,
    );

    expect(screen.getByRole('button', { name: 'Saving…' }).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState).toEqual({
      disabled: false,
    });
  });
});

describe('AppSelectField', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return (
      <AppSelectField
        label="Gender"
        onChange={setValue}
        options={[
          { value: '', label: 'Not specified' },
          { value: 'female', label: 'Female' },
        ]}
        value={value}
      />
    );
  }

  it('names its current value, opens a sheet of options and closes on a choice', () => {
    const screen = render(<Harness />);
    const field = screen.getByRole('button', { name: 'Gender: Not specified' });

    expect(field.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByRole('radio', { name: 'Female' })).toBeNull();
    fireEvent.press(field);
    expect(screen.getByRole('radio', { name: 'Not specified' }).props.accessibilityState).toEqual({
      selected: true,
    });

    fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
    expect(screen.getByRole('button', { name: 'Gender: Female' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Female' })).toBeNull();
  });
});
