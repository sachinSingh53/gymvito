import { fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import '@/i18n';

import { planColors } from '@/ui/theme/tokens';

import { PlanForm } from './plan-form';
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const session = {
      state: {
        status: 'unlocked',
        ownerId: 'owner',
        snapshot: { settings: { language: 'en', currencyCode: 'INR' } },
      },
      getPhase2Repository: () => ({}),
    };
    return () => session;
  })(),
}));

describe('PlanForm surface', () => {
  it('keeps 48dp colour swatches with their radio labels and selection state', () => {
    const screen = render(<PlanForm />);

    const swatches = screen
      .getAllByRole('radio')
      .filter((node) => (planColors as readonly string[]).includes(node.props.accessibilityLabel));
    expect(swatches).toHaveLength(planColors.length);
    for (const swatch of swatches) {
      const style = StyleSheet.flatten(swatch.props.style);
      expect(style.width).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeGreaterThanOrEqual(48);
    }
    expect(screen.getByLabelText(planColors[0]).props.accessibilityState).toEqual({
      selected: true,
    });

    fireEvent.press(screen.getByLabelText(planColors[2]));
    expect(screen.getByLabelText(planColors[2]).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByLabelText(planColors[0]).props.accessibilityState).toEqual({
      selected: false,
    });
    expect(screen.queryAllByText('check')).toHaveLength(1);
  });

  it('frosts the content panels without ever giving them a blur target', () => {
    const screen = render(<PlanForm />);
    const blurs = screen.UNSAFE_queryAllByType(BlurView);

    expect(blurs).toHaveLength(4);
    for (const blur of blurs) {
      expect(blur.props.blurTarget).toBeUndefined();
      expect(blur.props.blurMethod).toBe('none');
    }
  });
});
