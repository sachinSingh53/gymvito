import { act, render, waitFor } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';

import BackupRestoreRoute from '@/app/(app)/backup-restore';
import type { BackupHistoryRecord } from '@/data/repositories/phase5-repository';
import i18n from '@/i18n';
import { glass } from '@/ui/theme/tokens';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(effect, []);
  },
  useIsFocused: () => true,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/platform/files/document-files', () => ({ pickGymVitoBackup: jest.fn() }));
jest.mock('@/platform/runtime/runtime-capabilities', () => ({
  getRuntimeCapabilities: () => ({ nativeSecurityProofs: true }),
}));

const mockHistory: BackupHistoryRecord[] = [
  {
    id: 'one',
    operationType: 'backup',
    startedAtUtc: '2026-10-01T10:00:00.000Z',
    completedAtUtc: '2026-10-01T10:01:00.000Z',
    result: 'success',
    targetDescriptor: 'Downloads',
    schemaVersion: 7,
    fileSizeBytes: 1024,
    errorCode: null,
  },
  {
    id: 'two',
    operationType: 'restore',
    startedAtUtc: '2026-10-02T10:00:00.000Z',
    completedAtUtc: null,
    result: 'failed',
    targetDescriptor: '',
    schemaVersion: null,
    fileSizeBytes: null,
    errorCode: 'X',
  },
];

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const service = { listHistory: () => Promise.resolve(mockHistory) };
    const session = {
      state: {
        status: 'unlocked',
        ownerName: 'Owner',
        snapshot: { settings: { language: 'en' } },
      },
      getBackupService: () => service,
      changeLanguage: jest.fn(),
    };
    return () => session;
  })(),
}));

describe.each([true, false])('BackupRestoreRoute surface (GLASS_UI %s)', (enabled) => {
  beforeEach(async () => {
    mockGlassUi.enabled = enabled;
    await act(async () => i18n.changeLanguage('en'));
  });
  afterAll(() => {
    mockGlassUi.enabled = true;
  });

  it('shows each history result with its tone', async () => {
    const screen = render(<BackupRestoreRoute />);

    const verified = await screen.findByText('Verified');
    const failed = screen.getByText('Failed');
    if (enabled) {
      expect(verified.parent?.parent?.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ backgroundColor: glass.fillSuccess })]),
      );
      expect(failed.parent?.parent?.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ backgroundColor: glass.fillDanger })]),
      );
    } else {
      expect(verified.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ fontSize: 12 })]),
      );
    }
  });

  it('frosts the content panels without ever giving them a blur target', async () => {
    const screen = render(<BackupRestoreRoute />);
    await waitFor(() => expect(screen.getByText('Verified')).toBeTruthy());
    const blurs = screen.UNSAFE_queryAllByType(BlurView);

    expect(blurs.length > 0).toBe(enabled);
    for (const blur of blurs) {
      expect(blur.props.blurTarget).toBeUndefined();
      expect(blur.props.blurMethod).toBe('none');
    }
  });
});
