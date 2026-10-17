import { act, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import GymSettingsRoute from '@/app/(app)/gym-settings';
import SettingsRoute from '@/app/(app)/settings';
import i18n from '@/i18n';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const session = {
      state: {
        status: 'unlocked',
        ownerName: 'Owner',
        snapshot: {
          gym: { name: 'Iron Den', ownerName: 'Owner' },
          settings: { language: 'en', inactivityTimeoutSeconds: 300 },
        },
      },
      changeLanguage: jest.fn(),
      changeInactivityTimeout: jest.fn(),
      reauthenticateOwner: jest.fn(),
      lock: jest.fn(),
      updateGym: jest.fn(),
    };
    return () => session;
  })(),
}));

describe.each([true, false])('settings screens surface (GLASS_UI %s)', (enabled) => {
  beforeEach(async () => {
    mockGlassUi.enabled = enabled;
    await act(async () => i18n.changeLanguage('en'));
  });
  afterAll(() => {
    mockGlassUi.enabled = true;
  });

  it.each([
    ['Settings', SettingsRoute, 5],
    ['Gym settings', GymSettingsRoute, 7],
  ])('keeps %s radios at 48dp with their selection state', (_, Route, radioCount) => {
    const screen = render(<Route />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(radioCount);
    for (const radio of radios) {
      expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
    expect(radios.filter((radio) => radio.props.accessibilityState.selected).length).toBe(
      radioCount === 5 ? 2 : 3,
    );
    expect(
      screen.UNSAFE_getAllByProps({ accessibilityRole: 'radiogroup' }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it.each([
    ['Settings', SettingsRoute],
    ['Gym settings', GymSettingsRoute],
  ])('frosts the %s panels without giving them a blur target', (_, Route) => {
    const screen = render(<Route />);
    const blurs = screen.UNSAFE_queryAllByType(BlurView);

    // Header panel, content panel and the notices inside it.
    expect(blurs.length > 0).toBe(enabled);
    for (const blur of blurs) {
      expect(blur.props.blurTarget).toBeUndefined();
      expect(blur.props.blurMethod).toBe('none');
    }
  });
});
