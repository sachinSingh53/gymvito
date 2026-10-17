import { render } from '@testing-library/react-native';
import { BlurTargetView } from 'expo-blur';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import BusinessLayout from '@/app/(app)/_layout';
import { BusinessNavigation, FloatingHeaderHost } from '@/ui/components/operational-shell';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Stack: jest.fn(() => null),
}));

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: () => ({ state: { status: 'unlocked' } }),
}));

jest.mock('@/ui/components/operational-shell', () => ({
  BUSINESS_NAV_PHONE_HEIGHT: 68,
  BUSINESS_NAV_TABLET_WIDTH: 84,
  BusinessChromeProvider: ({ children }: { children: ReactNode }) => children,
  BusinessNavigation: jest.fn(() => null),
  FloatingHeaderHost: jest.fn(() => null),
  useBusinessNavigationInset: () => ({ left: 0, bottom: 80 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockStack = Stack as unknown as jest.Mock;

describe('BusinessLayout', () => {
  beforeEach(() => {
    mockStack.mockClear();
    (BusinessNavigation as jest.Mock).mockClear();
    (FloatingHeaderHost as jest.Mock).mockClear();
  });

  afterEach(() => {
    mockGlassUi.enabled = true;
  });

  it('keeps navigation and the floating header outside the blurred route stack', () => {
    const screen = render(<BusinessLayout />);

    const stackProps = mockStack.mock.calls[0][0];
    expect(stackProps.screenOptions).toEqual({
      animation: 'none',
      contentStyle: { backgroundColor: 'transparent' },
      headerShown: false,
    });
    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(1);
    expect(BusinessNavigation).toHaveBeenCalledTimes(1);
    expect(FloatingHeaderHost).toHaveBeenCalledTimes(1);
  });

  it('keeps the flat layout when GLASS_UI is off', () => {
    mockGlassUi.enabled = false;
    const screen = render(<BusinessLayout />);

    const stackProps = mockStack.mock.calls[0][0];
    expect(stackProps.screenOptions).toEqual({ animation: 'none', headerShown: false });
    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(0);
    expect(FloatingHeaderHost).not.toHaveBeenCalled();
    expect(BusinessNavigation).toHaveBeenCalledTimes(1);
  });
});
