import { fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import '@/i18n';

import { colors, glass } from '@/ui/theme/tokens';

import { ActionTile, GlassIconButton, GlassListRow } from './glass-controls';

describe('GlassIconButton', () => {
  it('is a 48dp accent bubble that keeps its label and does not blur', () => {
    const onPress = jest.fn();
    const screen = render(
      <GlassIconButton accessibilityLabel="Lock now" icon="lock" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Lock now' });

    expect(button).toHaveStyle({
      width: 48,
      height: 48,
      borderColor: glass.rimAccent,
      backgroundColor: glass.fillAccent,
    });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
  });
});

describe('ActionTile', () => {
  it('stacks icon over a single shrinking label, at least 48dp tall', () => {
    const screen = render(<ActionTile icon="person_add" label="Add member" onPress={jest.fn()} />);
    const tile = screen.getByRole('button', { name: 'Add member' });
    const label = screen.getByText('Add member');

    expect(StyleSheet.flatten(tile.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.8);
  });

  it('uses solid primary for the primary tile', () => {
    const screen = render(
      <ActionTile icon="person_add" label="Add member" onPress={jest.fn()} primary />,
    );

    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: colors.primary });
    expect(screen.getByText('Add member')).toHaveStyle({ color: colors.onPrimary });
  });
});

describe('GlassListRow', () => {
  it('shows identity, status and a 48dp action with its own label', () => {
    const onPress = jest.fn();
    const screen = render(
      <GlassListRow
        action={{
          icon: 'receipt_long',
          label: 'Record payment',
          accessibilityLabel: 'Record payment: Asha Rao',
          onPress,
        }}
        amount="₹1,200"
        avatarText="AR"
        meta="Monthly"
        status="Overdue"
        title="Asha Rao"
        tone="danger"
      />,
    );
    const action = screen.getByRole('button', { name: 'Record payment: Asha Rao' });

    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('AR')).toBeTruthy();
    expect(screen.getByText('Overdue')).toHaveStyle({ color: colors.dangerText });
    expect(screen.getByText('₹1,200')).toHaveStyle({ color: colors.danger });
    expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(action).toHaveStyle({ backgroundColor: colors.danger });
    fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without the action row when there is no amount or action', () => {
    const screen = render(<GlassListRow avatarText="AR" meta="Monthly" title="Asha Rao" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
  });
});
