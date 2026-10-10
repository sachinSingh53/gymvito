import { fireEvent, render } from '@testing-library/react-native';

import '@/i18n';

import type { MembershipDirectoryItem } from '@/data/repositories/phase3-repository';

import { MemberCard } from './member-card';

const MEMBER: MembershipDirectoryItem = {
  id: 'member-1',
  memberCode: 'GV-00001',
  name: 'अमित Sharma',
  phone: '+91 98765 43210',
  email: 'amit@example.com',
  isArchived: false,
  hasPhoto: false,
  createdAtUtc: '2026-10-08T00:00:00.000Z',
  updatedAtUtc: '2026-10-08T00:00:00.000Z',
  status: 'no-membership',
  current: null,
  upcoming: null,
  latest: null,
  historyCount: 0,
};

const MEMBERSHIP: NonNullable<MembershipDirectoryItem['current']> = {
  id: 'membership-1',
  operationId: 'operation-1',
  memberId: MEMBER.id,
  sourcePlanId: 'plan-1',
  priorMembershipId: null,
  lifecycleState: 'finalized',
  status: 'active',
  planName: 'Annual Strength',
  planDescription: '',
  planColorHex: '#0D6659',
  durationValue: 1,
  durationUnit: 'year',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  currencyCode: 'INR',
  planPriceMinor: 120_000,
  priceMinor: 120_000,
  admissionFeeMinor: 0,
  planDiscountType: 'none',
  planDiscountValue: 0,
  discountMinor: 0,
  taxLabel: '',
  taxRateBasisPoints: 0,
  taxMinor: 0,
  totalMinor: 120_000,
  renewalBehavior: 'after-expiry',
  overrideReason: '',
  overlapAcknowledged: false,
  createdAtUtc: '2026-01-01T00:00:00.000Z',
  finalizedAtUtc: '2026-01-01T00:00:00.000Z',
};

describe('MemberCard', () => {
  it('renders the directory identity and opens the profile', () => {
    const onPress = jest.fn();
    const screen = render(<MemberCard member={MEMBER} onPress={onPress} />);

    expect(screen.getByText('अS')).toBeTruthy();
    expect(screen.getByText('GV-00001')).toBeTruthy();
    expect(screen.getByText('+91 98765 43210')).toBeTruthy();
    expect(screen.getByText('No membership')).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Open अमित Sharma's profile"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the locally stored profile photo instead of initials when available', () => {
    const screen = render(
      <MemberCard
        member={{ ...MEMBER, hasPhoto: true }}
        onPress={jest.fn()}
        photo={{
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: 'image/jpeg',
          width: 256,
          height: 256,
        }}
      />,
    );

    expect(
      screen.UNSAFE_getByProps({ accessibilityLabel: 'Profile photo for अमित Sharma' }).props
        .source,
    ).toEqual({
      uri: 'data:image/jpeg;base64,AQID',
    });
    expect(screen.queryByText('अS')).toBeNull();
  });

  it('shows preserved archived state without erasing membership history', () => {
    const screen = render(
      <MemberCard
        member={{ ...MEMBER, isArchived: true, status: 'archived', phone: '', email: '' }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('No contact details')).toBeTruthy();
    expect(screen.getByText('Enroll now')).toBeTruthy();
  });

  it('shows the derived membership state, snapshotted plan, and inclusive end date', () => {
    const screen = render(
      <MemberCard
        member={{
          ...MEMBER,
          status: 'active',
          current: MEMBERSHIP,
          latest: MEMBERSHIP,
          historyCount: 1,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByText('Annual Strength')).toBeTruthy();
    expect(screen.getByText('Exp: 2026-12-31')).toBeTruthy();
    expect(screen.getByText('Renew plan')).toBeTruthy();
  });

  it('uses local billing data and regional formatting in the approved directory treatment', () => {
    const screen = render(
      <MemberCard
        finance={{
          invoicedMinor: 120_000,
          paidMinor: 120_000,
          balanceMinor: 0,
          overdueMinor: 0,
          invoiceCount: 1,
          paymentCount: 1,
          latestOutstandingInvoiceId: null,
        }}
        member={{
          ...MEMBER,
          status: 'active',
          current: MEMBERSHIP,
          latest: MEMBERSHIP,
          historyCount: 1,
        }}
        onPress={jest.fn()}
        regionalSettings={{
          language: 'en',
          currencyCode: 'INR',
          dateFormat: 'day-month-year',
        }}
      />,
    );

    expect(screen.getByText('Paid in full')).toBeTruthy();
    expect(screen.getByText('Exp: 31 Dec 2026')).toBeTruthy();
    expect(screen.queryByText('Renew plan')).toBeNull();
  });

  it('promotes overdue local balances ahead of the membership status', () => {
    const screen = render(
      <MemberCard
        finance={{
          invoicedMinor: 120_000,
          paidMinor: 95_000,
          balanceMinor: 25_000,
          overdueMinor: 25_000,
          invoiceCount: 1,
          paymentCount: 1,
          latestOutstandingInvoiceId: 'invoice-1',
        }}
        member={{
          ...MEMBER,
          status: 'active',
          current: MEMBERSHIP,
          latest: MEMBERSHIP,
          historyCount: 1,
        }}
        onPress={jest.fn()}
        regionalSettings={{
          language: 'en',
          currencyCode: 'INR',
          dateFormat: 'day-month-year',
        }}
      />,
    );

    expect(screen.getByText(/₹250\.00 Due/)).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
  });
});
