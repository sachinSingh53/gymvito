import { fireEvent, render, within } from '@testing-library/react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { router, useIsFocused, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import '@/i18n';

import { parseColor } from '@/ui/theme/contrast';
import { CARD_RADIUS, colors, glass, radii } from '@/ui/theme/tokens';

import { GlassBlurTarget, GlassProvider } from './glass-context';
import {
  BusinessChromeProvider,
  BusinessNavigation,
  FloatingHeaderHost,
  LocalDataBadge,
  OperationalShell,
  StatusChip,
  SurfaceCard,
} from './operational-shell';
const mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

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
});

describe('shared glass surfaces', () => {
  function backgrounds(screen: ReturnType<typeof render>) {
    return screen
      .UNSAFE_getAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style)?.backgroundColor);
  }

  it('renders SurfaceCard as a glass panel with card radius and no blur target', () => {
    const screen = render(
      <SurfaceCard style={{ gap: 8 }}>
        <Text>Plan</Text>
      </SurfaceCard>,
    );

    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
    expect(screen.UNSAFE_getByType(BlurView).props.blurTarget).toBeUndefined();
    expect(screen.toJSON()).toHaveStyle({ borderRadius: CARD_RADIUS, padding: 16, gap: 8 });
  });

  it("turns a caller's background into the glass tint so warnings stay visible", () => {
    const screen = render(
      <SurfaceCard
        style={{ borderColor: colors.warningBorder, backgroundColor: colors.warningSurface }}
      >
        <Text>Possible duplicate</Text>
      </SurfaceCard>,
    );

    expect(screen.toJSON()).toHaveStyle({ borderColor: colors.warningBorder });
    expect(screen.toJSON()).not.toHaveStyle({ backgroundColor: colors.warningSurface });
    expect(backgrounds(screen)).toContain(colors.warningSurface);
  });

  it('draws status chips as tone pills at 0.8 alpha or more with text of 10pt or more', () => {
    const tones = {
      neutral: [glass.fillNeutral, colors.text],
      active: [glass.fillSuccess, colors.successText],
      warning: [glass.fillWarning, colors.warningText],
      danger: [glass.fillDanger, colors.dangerText],
    } as const;
    for (const [tone, [fill, text]] of Object.entries(tones)) {
      const screen = render(<StatusChip label={tone} tone={tone as keyof typeof tones} />);
      expect(screen.toJSON()).toHaveStyle({ borderRadius: radii.pill, backgroundColor: fill });
      expect(parseColor(fill)[3]).toBeGreaterThanOrEqual(0.8);
      const label = StyleSheet.flatten(screen.getByText(tone).props.style);
      expect(label.color).toBe(text);
      expect(label.fontSize).toBeGreaterThanOrEqual(10);
      screen.unmount();
    }
  });

  it('draws the local data badge as a neutral glass chip', () => {
    const screen = render(<LocalDataBadge />);

    expect(screen.toJSON()).toHaveStyle({
      borderColor: glass.rimAccent,
      borderRadius: radii.pill,
      backgroundColor: glass.fillNeutral,
    });
    expect(
      StyleSheet.flatten(screen.getByText('SAVED ON THIS DEVICE').props.style).fontSize,
    ).toBeGreaterThanOrEqual(10);
  });
});
