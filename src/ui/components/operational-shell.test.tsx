import { fireEvent, render } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { Text } from 'react-native';

import '@/i18n';

import { BusinessNavigation, OperationalShell } from './operational-shell';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: jest.fn(() => '/home'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: () => ({
    state: {
      status: 'unlocked',
      ownerName: 'Gym Owner',
      snapshot: { settings: { language: 'en' } },
    },
    changeLanguage: jest.fn(),
    lock: jest.fn(),
  }),
}));

const mockNavigate = router.navigate as jest.Mock;
const mockReplace = router.replace as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockCanGoBack = router.canGoBack as jest.Mock;
const mockUsePathname = usePathname as jest.Mock;

describe('OperationalShell navigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockCanGoBack.mockReset().mockReturnValue(true);
    mockUsePathname.mockReturnValue('/home');
  });

  it('navigates between sections without replacing the active route', () => {
    const screen = render(<BusinessNavigation />);
    const tabs = screen.getAllByRole('tab');

    fireEvent.press(tabs[0]);
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.press(tabs[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/members');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps navigation outside the route-level operational shell', () => {
    const screen = render(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('Dashboard content')).toBeTruthy();
  });

  it('offers an accessible back action for detail screens', () => {
    const screen = render(
      <OperationalShell active="payments" canGoBack title="Invoice detail">
        <Text>Invoice content</Text>
      </OperationalShell>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('uses the section route when a detail screen has no navigation history', () => {
    mockCanGoBack.mockReturnValue(false);
    const screen = render(
      <OperationalShell active="more" backHref="/plans" canGoBack title="New plan">
        <Text>Plan form</Text>
      </OperationalShell>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/plans');
  });
});
