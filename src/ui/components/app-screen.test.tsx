import { fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import '@/i18n';

import { colors } from '@/ui/theme/tokens';

import { AppScreen } from './app-screen';
import { GlassBlurTarget, GlassProvider } from './glass-context';

const mockGlassUi = { enabled: true };
const mockNavigationInset = { left: 0, bottom: 0 };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return { SafeAreaView: MockView };
});

jest.mock('./operational-shell', () => ({
  MaterialSymbol: () => null,
  useBusinessNavigationInset: () => mockNavigationInset,
}));

describe('AppScreen', () => {
  afterEach(() => {
    mockGlassUi.enabled = true;
    mockNavigationInset.bottom = 0;
  });

  it('stays flat unless glass is requested', () => {
    const screen = render(
      <AppScreen title="Language">
        <Text>Choose</Text>
      </AppScreen>,
    );

    expect(screen.getByRole('header', { name: 'Language' })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
  });

  it('renders the header and content as frosted panels in glass mode', () => {
    const screen = render(
      <AppScreen canGoBack glass subtitle="Pick one" title="Language">
        <Text>Choose</Text>
      </AppScreen>,
    );

    expect(screen.getByRole('header', { name: 'Language' })).toBeTruthy();
    expect(screen.getByText('Pick one')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(2);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('uses the layout backdrop when a glass layout provides one', () => {
    const standalone = render(
      <AppScreen glass title="Gym">
        <Text>Form</Text>
      </AppScreen>,
    );
    const inLayout = render(
      <GlassProvider>
        <GlassBlurTarget>
          <AppScreen glass title="Gym">
            <Text>Form</Text>
          </AppScreen>
        </GlassBlurTarget>
      </GlassProvider>,
    );

    expect(standalone.toJSON()).toHaveStyle({ backgroundColor: colors.background });
    expect(
      inLayout
        .UNSAFE_getAllByType(View)
        .find((view) => StyleSheet.flatten(view.props.style)?.backgroundColor === 'transparent'),
    ).toBeDefined();
  });

  it('leaves room for the floating business navigation', () => {
    mockNavigationInset.bottom = 80;
    const screen = render(
      <AppScreen title="Settings">
        <Text>Settings</Text>
      </AppScreen>,
    );

    expect(
      StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle),
    ).toMatchObject({ paddingBottom: 80 });
  });

  it('ignores glass when GLASS_UI is off', () => {
    mockGlassUi.enabled = false;
    const screen = render(
      <AppScreen glass title="Language">
        <Text>Choose</Text>
      </AppScreen>,
    );

    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    expect(screen.getByText('Choose')).toBeTruthy();
  });
});
