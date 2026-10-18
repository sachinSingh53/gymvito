import { fireEvent, render } from '@testing-library/react-native';

import '@/i18n';

import { DateRangeFilter, FilterChip, FilterSelect } from './filter-controls';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('@/ui/components/operational-shell', () => ({
  MaterialSymbol: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('FilterChip', () => {
  it('announces a toggle chip as a selectable radio with its count', () => {
    const onPress = jest.fn();
    const screen = render(<FilterChip count={4} label="Active" onPress={onPress} selected />);

    const chip = screen.getByRole('radio', { name: /Active/ });
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('4')).toBeTruthy();
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });

  it('keeps the 48dp touch target around the compact chip', () => {
    const screen = render(
      <FilterChip kind="action" label="Reset" onPress={jest.fn()} selected={false} />,
    );
    expect(screen.getByRole('button', { name: 'Reset' }).props.hitSlop).toEqual({
      top: 4,
      bottom: 4,
      left: 0,
      right: 0,
    });
  });
});

describe('FilterSelect', () => {
  const options = [
    { value: null, label: 'All plans' },
    { value: 'gold', label: 'Gold' },
  ] as const;

  it('shows the current choice and changes it from the sheet', () => {
    const onChange = jest.fn();
    const screen = render(
      <FilterSelect
        defaultValue={null}
        onChange={onChange}
        options={options}
        title="Plan"
        value={null}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Plan: All plans' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Gold' }));
    expect(onChange).toHaveBeenCalledWith('gold');
  });
});

describe('DateRangeFilter', () => {
  const presets = [
    { key: 'last7', label: 'Last 7 days', from: '2026-10-11', to: '2026-10-17' },
    { key: 'last30', label: 'Last 30 days', from: '2026-09-18', to: '2026-10-17' },
  ];

  it('names the matching preset and applies another one', () => {
    const onChange = jest.fn();
    const screen = render(
      <DateRangeFilter
        defaultPresetKey="last30"
        from="2026-09-18"
        fromLabel="From date"
        onChange={onChange}
        presets={presets}
        rangeLabel="18/09/2026 – 17/10/2026"
        title="Date range"
        to="2026-10-17"
        toLabel="To date"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Date range: Last 30 days' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Last 7 days' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-11', '2026-10-17');
  });

  it('falls back to the range label for a custom range', () => {
    const screen = render(
      <DateRangeFilter
        defaultPresetKey="last30"
        from="2026-10-01"
        fromLabel="From date"
        onChange={jest.fn()}
        presets={presets}
        rangeLabel="01/10/2026 – 17/10/2026"
        title="Date range"
        to="2026-10-17"
        toLabel="To date"
      />,
    );

    expect(screen.getByText('01/10/2026 – 17/10/2026')).toBeTruthy();
  });
});
