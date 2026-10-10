import { act, render } from '@testing-library/react-native';

import HelpPrivacyRoute from '@/app/(app)/help-privacy';
import i18n from '@/i18n';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  usePathname: jest.fn(() => '/help-privacy'),
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

describe('HelpPrivacyRoute', () => {
  beforeEach(async () => {
    await act(async () => i18n.changeLanguage('en'));
  });

  it('exposes the release privacy and irreversible-loss guidance as accessible content', () => {
    const screen = render(<HelpPrivacyRoute />);

    expect(screen.getByText('Help & privacy')).toBeTruthy();
    expect(screen.getByText(/permanently erase every record/i)).toBeTruthy();
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('App version 1.0.0')).toBeTruthy();
  });

  it('renders the complete second-language help surface without raw keys', async () => {
    await act(async () => i18n.changeLanguage('hi'));
    const screen = render(<HelpPrivacyRoute />);

    expect(screen.getByText('सहायता और गोपनीयता')).toBeTruthy();
    expect(screen.getByText('बैकअप और रिकवरी')).toBeTruthy();
    expect(screen.queryByText('privacyStoredFields')).toBeNull();
  });
});
