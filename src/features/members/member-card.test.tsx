import { fireEvent, render } from '@testing-library/react-native';

import '@/i18n';

import type { MemberListItem } from '@/data/repositories/phase2-repository';

import { MemberCard } from './member-card';

const MEMBER: MemberListItem = {
  id: 'member-1',
  memberCode: 'GV-00001',
  name: 'अमित Sharma',
  phone: '+91 98765 43210',
  email: 'amit@example.com',
  isArchived: false,
  hasPhoto: false,
  createdAtUtc: '2026-10-08T00:00:00.000Z',
  updatedAtUtc: '2026-10-08T00:00:00.000Z',
};

describe('MemberCard', () => {
  it('renders the Phase 2 directory identity and opens the profile', () => {
    const onPress = jest.fn();
    const screen = render(<MemberCard member={MEMBER} onPress={onPress} />);

    expect(screen.getByText('अS')).toBeTruthy();
    expect(screen.getByText('GV-00001')).toBeTruthy();
    expect(screen.getByText('+91 98765 43210')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Open अमित Sharma's profile"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows preserved archived state without exposing future membership data', () => {
    const screen = render(
      <MemberCard
        member={{ ...MEMBER, isArchived: true, phone: '', email: '' }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('No contact details')).toBeTruthy();
    expect(screen.getByText('Available in Phase 3')).toBeTruthy();
  });
});
