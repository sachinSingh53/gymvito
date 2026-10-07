import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';

import BusinessLayout from '@/app/(app)/_layout';
import { BusinessNavigation } from '@/ui/components/operational-shell';

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
  BusinessNavigation: jest.fn(() => null),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('BusinessLayout', () => {
  it('keeps navigation mounted outside the route stack', () => {
    render(<BusinessLayout />);

    const stackProps = (Stack as unknown as jest.Mock).mock.calls[0][0];
    expect(stackProps.screenOptions).toEqual({
      animation: 'none',
      headerShown: false,
    });
    expect(BusinessNavigation).toHaveBeenCalledTimes(1);
  });
});
