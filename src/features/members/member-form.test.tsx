import { render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import '@/i18n';

import { MemberForm } from './member-form';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/platform/images/member-photo', () => ({
  memberPhotoDataUri: () => 'data:image/jpeg;base64,AA==',
  pickMemberPhoto: jest.fn(),
}));
jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const member = {
      id: 'member-1',
      memberCode: 'GV-00001',
      name: 'अमित Sharma',
      phone: '',
      email: '',
      dateOfBirth: '',
      gender: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      joiningSource: '',
      notes: [],
      audit: [],
      photo: {
        id: 'photo-1',
        bytes: new Uint8Array([0]),
        mimeType: 'image/jpeg',
        width: 1,
        height: 1,
      },
    };
    const session = {
      state: { status: 'unlocked', ownerId: 'owner', snapshot: { settings: { language: 'en' } } },
      getPhase2Repository: () => ({ getMember: async () => member }),
    };
    return () => session;
  })(),
}));

describe.each([true, false])('MemberForm surface (GLASS_UI %s)', (enabled) => {
  beforeEach(() => {
    mockGlassUi.enabled = enabled;
  });
  afterAll(() => {
    mockGlassUi.enabled = true;
  });

  it('keeps a 48dp remove-photo button and the read-only member code', async () => {
    const screen = render(<MemberForm memberId="member-1" />);

    const remove = await screen.findByRole('button', { name: 'Remove photo' });
    expect(StyleSheet.flatten(remove.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.getByText('GV-00001')).toBeTruthy();
    const blurs = screen.UNSAFE_queryAllByType(BlurView);
    expect(blurs.length > 0).toBe(enabled);
    for (const blur of blurs) expect(blur.props.blurTarget).toBeUndefined();
  });
});
