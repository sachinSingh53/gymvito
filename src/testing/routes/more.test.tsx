import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import MoreRoute from '@/app/(app)/more';
import i18n from '@/i18n';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  usePathname: jest.fn(() => '/more'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: () => ({
    state: {
      status: 'unlocked',
      ownerName: 'Owner',
      snapshot: { settings: { language: 'en' } },
    },
    changeLanguage: jest.fn(),
  }),
}));

describe('MoreRoute', () => {
  beforeEach(async () => {
    jest.mocked(router.push).mockClear();
    await act(async () => i18n.changeLanguage('en'));
  });

  it('opens each management and data tool from a 48dp or taller row', () => {
    const screen = render(<MoreRoute />);
    const routes = {
      'Membership plans': '/plans',
      Settings: '/settings',
      'Billing and receipt settings': '/billing-settings',
      'Backup and recovery': '/backup-restore',
      Reports: '/reports',
      'Help & privacy': '/help-privacy',
      'Data export': '/data-export',
    };

    for (const [name, route] of Object.entries(routes)) {
      const row = screen.getByRole('button', { name });
      expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
      fireEvent.press(row);
      expect(router.push).toHaveBeenLastCalledWith(route);
    }
    expect(screen.getByRole('header', { name: 'Management' })).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'summary' })).toBeTruthy();
  });

  it('renders the Hindi menu without raw keys', async () => {
    await act(async () => i18n.changeLanguage('hi'));
    const screen = render(<MoreRoute />);

    expect(screen.getByRole('button', { name: 'सदस्यता प्लान' })).toBeTruthy();
    expect(screen.queryByText(/Subtitle$/)).toBeNull();
  });
});
