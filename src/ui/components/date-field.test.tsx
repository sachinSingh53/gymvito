import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import '@/i18n';

import { AppDateField, dateOnlyToLocalDate, localDateToDateOnly } from './date-field';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('@/ui/components/operational-shell', () => ({
  MaterialSymbol: () => null,
}));

const open = DateTimePickerAndroid.open as jest.Mock;

describe('date-only conversions', () => {
  it('round-trips a calendar day through local time', () => {
    const date = dateOnlyToLocalDate('2026-02-28');
    expect(date && localDateToDateOnly(date)).toBe('2026-02-28');
  });

  it('ignores partial or malformed input', () => {
    expect(dateOnlyToLocalDate('2026-1')).toBeUndefined();
    expect(dateOnlyToLocalDate('')).toBeUndefined();
  });
});

describe('AppDateField', () => {
  beforeEach(() => {
    open.mockReset();
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps typed entry working', () => {
    const onChangeText = jest.fn();
    const screen = render(
      <AppDateField label="From date" onChangeText={onChangeText} value="2026-10-01" />,
    );

    fireEvent.changeText(screen.getByLabelText('From date'), '2026-10-05');
    expect(onChangeText).toHaveBeenCalledWith('2026-10-05');
  });

  it('opens the native calendar within bounds and writes the chosen day back', () => {
    const onChangeText = jest.fn();
    const screen = render(
      <AppDateField
        label="To date"
        minimumDate="2026-10-10"
        onChangeText={onChangeText}
        value="2026-10-01"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: /calendar/i }));
    const options = open.mock.calls[0][0];
    expect(options.mode).toBe('date');
    expect(localDateToDateOnly(options.value)).toBe('2026-10-10');
    expect(localDateToDateOnly(options.minimumDate)).toBe('2026-10-10');

    options.onChange({ type: 'set' }, new Date(2026, 10, 3));
    expect(onChangeText).toHaveBeenCalledWith('2026-11-03');
  });

  it('leaves the value alone when the calendar is dismissed', () => {
    const onChangeText = jest.fn();
    const screen = render(<AppDateField label="Date" onChangeText={onChangeText} value="" />);

    fireEvent.press(screen.getByRole('button', { name: /calendar/i }));
    open.mock.calls[0][0].onChange({ type: 'dismissed' });
    expect(onChangeText).not.toHaveBeenCalled();
  });
});
