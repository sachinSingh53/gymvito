import { fireEvent, render, within } from '@testing-library/react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { router, useIsFocused, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import '@/i18n';

import { colors } from '@/ui/theme/tokens';

import { GlassBlurTarget, GlassProvider } from './glass-context';
import {
  BusinessChromeProvider,
  BusinessNavigation,
  FloatingHeaderHost,
  OperationalShell,
} from './operational-shell';

const mockGlassUi = { enabled: true };
const mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
    replace: jest.fn(),
  },
  useIsFocused: jest.fn(() => true),
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
const mockUseIsFocused = useIsFocused as jest.Mock;

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

describe('OperationalShell glass chrome', () => {
  afterEach(() => {
    mockGlassUi.enabled = true;
    mockWindow.width = 390;
    mockUseIsFocused.mockClear().mockReturnValue(true);
  });

  function renderInBusinessChrome(children: ReactNode) {
    return render(
      <GlassProvider>
        <BusinessChromeProvider>
          <FloatingHeaderHost />
          <GlassBlurTarget>{children}</GlassBlurTarget>
          <BusinessNavigation />
        </BusinessChromeProvider>
      </GlassProvider>,
    );
  }

  it('renders the header beside the blur target so it can blur the routes', () => {
    const screen = renderInBusinessChrome(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );
    const [target] = screen.UNSAFE_getAllByType(BlurTargetView);

    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(1);
    expect(within(target).getByText('Dashboard content')).toBeTruthy();
    expect(within(target).queryByText('Dashboard')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(2);
  });

  it('drops the header of a screen that is no longer focused', () => {
    mockUseIsFocused.mockReturnValue(false);
    const screen = renderInBusinessChrome(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );

    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByText('Dashboard content')).toBeTruthy();
  });

  it('pads scrolling content clear of the floating phone navigation', () => {
    const screen = renderInBusinessChrome(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView);

    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      paddingBottom: 12 + 68 + 16,
    });
  });

  it('keeps 48dp tabs with their roles and selected state on the glass navigation', () => {
    const screen = render(<BusinessNavigation />);
    const tabs = screen.getAllByRole('tab');

    expect(tabs).toHaveLength(4);
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true });
    for (const tab of tabs) {
      expect(StyleSheet.flatten(tab.props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
  });

  it('floats the tablet rail beside the routes and keeps the header clear of it', () => {
    mockWindow.width = 1024;
    const screen = renderInBusinessChrome(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );

    expect(screen.getByText('GYMVITO')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeTruthy();
    const header = screen
      .UNSAFE_getAllByType(View)
      .find(
        (view) =>
          StyleSheet.flatten(view.props.style)?.position === 'absolute' &&
          StyleSheet.flatten(view.props.style)?.top === 12,
      );
    expect(StyleSheet.flatten(header?.props.style)).toMatchObject({ left: 12 + 84 + 12 });
  });

  it('renders the header inline outside the business layout', () => {
    mockUseIsFocused.mockClear();
    const screen = render(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Dashboard content')).toBeTruthy();
    expect(mockUseIsFocused).not.toHaveBeenCalled();
  });

  it('renders the flat shell and solid navigation when GLASS_UI is off', () => {
    mockGlassUi.enabled = false;
    const shell = render(
      <OperationalShell active="home" title="Dashboard">
        <Text>Dashboard content</Text>
      </OperationalShell>,
    );
    const navigation = render(<BusinessNavigation />);

    expect(shell.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    expect(shell.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(0);
    expect(shell.getByText('Dashboard')).toBeTruthy();
    expect(navigation.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    expect(navigation.toJSON()).toHaveStyle({ backgroundColor: colors.background });
  });
});
