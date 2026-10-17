import { act, fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import type { ComponentType } from 'react';
import { StyleSheet, Text } from 'react-native';

import LanguageRoute from '@/app/(public)/language';
import RecoveryRoute from '@/app/(public)/recovery';
import BackupIntroRoute from '@/app/(setup)/backup-intro';
import GymSetupRoute from '@/app/(setup)/gym';
import SecuritySetupRoute from '@/app/(setup)/security';
import i18n from '@/i18n';
import { pickGymVitoBackup } from '@/platform/files/document-files';
import { GlassSurface } from '@/ui/components/glass-surface';
import { colors, glass } from '@/ui/theme/tokens';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/platform/files/document-files', () => ({ pickGymVitoBackup: jest.fn() }));
jest.mock('@/platform/runtime/runtime-capabilities', () => ({
  getRuntimeCapabilities: () => ({ nativeSecurityProofs: true, isExpoGo: false }),
}));

const mockSession = {
  state: {
    status: 'setup-required',
    step: 'language',
    snapshot: { gym: null, settings: null },
  },
  chooseLanguage: jest.fn(),
  saveGym: jest.fn(),
  saveSecurity: jest.fn(),
  completeOnboarding: jest.fn(),
  previewRecoveryBackup: jest.fn(() =>
    Promise.resolve({
      gymName: 'Iron Den',
      createdAtUtc: '2026-10-01T10:00:00.000Z',
      recordCounts: { member: 12, payment: 30 },
    }),
  ),
  recoverFromBackup: jest.fn(),
};

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: () => mockSession,
}));

const screens: [string, ComponentType, string, number][] = [
  ['Language', LanguageRoute, 'language', 2],
  ['Recovery', RecoveryRoute, 'language', 2],
  ['Gym setup', GymSetupRoute, 'gym', 7],
  ['Security setup', SecuritySetupRoute, 'security', 0],
  ['Backup intro', BackupIntroRoute, 'backup-intro', 0],
];

describe.each([true, false])('first-run screens surface (GLASS_UI %s)', (enabled) => {
  beforeEach(async () => {
    mockGlassUi.enabled = enabled;
    await act(async () => i18n.changeLanguage('en'));
  });
  afterAll(() => {
    mockGlassUi.enabled = true;
  });

  describe.each(screens)('%s', (_, Route, step, radioCount) => {
    beforeEach(() => {
      mockSession.state.step = step;
    });

    it.each(['en', 'hi'])('keeps controls at 48dp and text at 10pt or more (%s)', async (lng) => {
      await act(async () => i18n.changeLanguage(lng));
      const screen = render(<Route />);

      const controls = [
        ...screen.queryAllByRole('button'),
        ...screen.queryAllByRole('radio'),
        ...screen.queryAllByRole('checkbox'),
      ];
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(48);
      }
      expect(screen.queryAllByRole('radio')).toHaveLength(radioCount);
      for (const text of screen.UNSAFE_getAllByType(Text)) {
        expect(StyleSheet.flatten(text.props.style)?.fontSize ?? 14).toBeGreaterThanOrEqual(10);
      }
      expect(screen.getAllByRole('header').length).toBeGreaterThan(0);
    });

    it('frosts the panels without giving them a blur target', () => {
      const screen = render(<Route />);
      const blurs = screen.UNSAFE_queryAllByType(BlurView);
      const title = screen.getAllByRole('header')[0];

      expect(
        screen
          .UNSAFE_queryAllByType(GlassSurface)
          .some((panel) => panel.findAll((node) => node === title).length > 0),
      ).toBe(enabled);

      expect(blurs.length > 0).toBe(enabled);
      for (const blur of blurs) {
        expect(blur.props.blurTarget).toBeUndefined();
        expect(blur.props.blurMethod).toBe('none');
      }
    });
  });

  it('shows the recovery preview as an accent well in glass mode', async () => {
    jest.mocked(pickGymVitoBackup).mockResolvedValue({ name: 'gym.gymvito' } as never);
    const screen = render(<RecoveryRoute />);

    await act(async () => fireEvent.press(screen.getByText('Select .gymvito file')));
    fireEvent.changeText(screen.getByLabelText('Backup passphrase'), 'correct horse battery');
    await act(async () => fireEvent.press(screen.getByText('Validate and preview')));

    const well = screen.getByText('Iron Den').parent?.parent;
    const style = StyleSheet.flatten(well?.props.style);
    expect(style.backgroundColor).toBe(enabled ? glass.fillAccent : colors.surfaceLow);
    expect(style.borderColor).toBe(enabled ? glass.rimPrimary : colors.primary);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });
});
