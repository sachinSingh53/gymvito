import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet, Text } from 'react-native';

import UnlockRoute from '@/app/(public)/unlock';
import i18n from '@/i18n';
import { GlassSurface } from '@/ui/components/glass-surface';

type ReactTestInstance = ReturnType<RenderAPI['getByText']>;

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({ Redirect: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockSession = {
  state: {
    status: 'locked',
    snapshot: { settings: { language: 'en', biometricsEnabled: true } },
  },
  unlockWithPin: jest.fn(() => Promise.resolve({ status: 'invalid-pin' })),
  unlockWithBiometrics: jest.fn(() => Promise.resolve('success')),
  changeLanguage: jest.fn(() => Promise.resolve()),
};

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: () => mockSession,
}));

function hasGlassAncestor(node: ReactTestInstance): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === GlassSurface) return true;
  }
  return false;
}

function buttonSize(button: ReactTestInstance) {
  const style = StyleSheet.flatten(button.props.style);
  return {
    height: Math.max(Number(style.height ?? 0), Number(style.minHeight ?? 0)),
    width: Math.max(Number(style.width ?? 0), Number(style.minWidth ?? 0)),
  };
}

describe.each([true, false])('unlock surface (GLASS_UI %s)', (enabled) => {
  beforeEach(async () => {
    mockGlassUi.enabled = enabled;
    jest.clearAllMocks();
    await act(async () => i18n.changeLanguage('en'));
  });
  afterAll(() => {
    mockGlassUi.enabled = true;
  });

  it('keeps the button labels and roles', () => {
    const screen = render(<UnlockRoute />);

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel ?? null);
    expect(labels).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'Use biometrics',
      '0',
      'Delete last digit',
      null,
      'Language',
    ]);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('PIN keypad')).toBeTruthy();
  });

  it.each(['en', 'hi'])(
    'keeps touch targets at 48dp and text at 10pt or more (%s)',
    async (lng) => {
      await act(async () => i18n.changeLanguage(lng));
      const screen = render(<UnlockRoute />);

      for (const button of screen.getAllByRole('button')) {
        const { height, width } = buttonSize(button);
        expect(height).toBeGreaterThanOrEqual(48);
        // Full-width buttons take their width from layout; only fixed-size ones set one.
        if (width) expect(width).toBeGreaterThanOrEqual(48);
      }
      for (const text of screen.UNSAFE_getAllByType(Text)) {
        expect(StyleSheet.flatten(text.props.style)?.fontSize ?? 14).toBeGreaterThanOrEqual(10);
      }
    },
  );

  it('keeps every line of text on a panel rather than the bare backdrop', () => {
    const screen = render(<UnlockRoute />);

    const loose = screen
      .UNSAFE_getAllByType(Text)
      .filter((text) => typeof text.props.children === 'string' && !hasGlassAncestor(text))
      .map((text) => text.props.children);
    expect(loose).toEqual([]);
  });

  it('blurs only the floating header', () => {
    const screen = render(<UnlockRoute />);
    const surfaces = screen.UNSAFE_getAllByType(GlassSurface);
    const blurred = surfaces.filter((surface) => surface.props.blurTarget);

    expect(surfaces).toHaveLength(4);
    expect(blurred).toEqual([surfaces[surfaces.length - 1]]);
    expect(screen.UNSAFE_queryAllByType(BlurView).length > 0).toBe(enabled);
  });

  it('still enters and submits the PIN from the keypad', async () => {
    const screen = render(<UnlockRoute />);

    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      fireEvent.press(screen.getByLabelText(digit));
    }
    expect(screen.getByLabelText('6 digits entered')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Unlock')));

    expect(mockSession.unlockWithPin).toHaveBeenCalledWith('123456');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('switches language from the header toggle', () => {
    const screen = render(<UnlockRoute />);

    fireEvent.press(screen.getByLabelText('Language'));
    expect(mockSession.changeLanguage).toHaveBeenCalledWith('hi');
  });
});
