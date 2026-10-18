import { act, fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import '@/i18n';

import { MemberForm } from './member-form';
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/platform/images/member-photo', () => ({
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  captureMemberPhoto: jest.fn(),
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
      gender: 'Male',
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

describe('MemberForm surface', () => {
  it('keeps a 48dp remove-photo button and the read-only member code', async () => {
    const screen = render(<MemberForm memberId="member-1" />);

    const remove = await screen.findByRole('button', { name: 'Remove photo' });
    expect(StyleSheet.flatten(remove.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.getByText('GV-00001')).toBeTruthy();
    const blurs = screen.UNSAFE_queryAllByType(BlurView);
    expect(blurs.length).toBeGreaterThan(0);
    for (const blur of blurs) expect(blur.props.blurTarget).toBeUndefined();
  });

  it('offers the camera alongside the file picker and says when camera access is off', async () => {
    const { captureMemberPhoto, pickMemberPhoto } = jest.requireMock<{
      captureMemberPhoto: jest.Mock;
      pickMemberPhoto: jest.Mock;
    }>('@/platform/images/member-photo');
    captureMemberPhoto.mockRejectedValueOnce(new Error('CAMERA_PERMISSION_DENIED'));
    pickMemberPhoto.mockResolvedValueOnce(null);
    const screen = render(<MemberForm />);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Take photo' })));
    expect(captureMemberPhoto).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Camera access is off/)).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Choose photo' })));
    expect(pickMemberPhoto).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Camera access is off/)).toBeNull();
  });

  it('picks gender from a dropdown and maps an old free-text value to its option', async () => {
    const editing = render(<MemberForm memberId="member-1" />);
    expect(await editing.findByRole('button', { name: 'Gender (optional): Male' })).toBeTruthy();
    editing.unmount();

    const screen = render(<MemberForm />);
    fireEvent.press(screen.getByRole('button', { name: 'Gender (optional): Not specified' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
    expect(screen.getByRole('button', { name: 'Gender (optional): Female' })).toBeTruthy();
  });
});
