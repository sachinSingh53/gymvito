import { act, fireEvent, render } from '@testing-library/react-native';

import '@/i18n';

import type { MemberRecord } from '@/data/repositories/phase2-repository';

import { MemberProfilePanel } from './member-profile-panel';

const mockPhase2Repository = {
  setMemberArchived: jest.fn(),
};
const mockPhase3Repository = {
  listMemberships: jest.fn(async () => []),
  listMembershipEvents: jest.fn(async () => []),
  getMemberSummary: jest.fn(async () => null),
};
const mockPhase4Repository = {
  getMemberFinanceSummary: jest.fn(async () => ({
    invoicedMinor: 0,
    paidMinor: 0,
    balanceMinor: 0,
    overdueMinor: 0,
    invoiceCount: 0,
    paymentCount: 0,
    latestOutstandingInvoiceId: null,
  })),
  listMemberInvoices: jest.fn(async () => []),
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('@/features/memberships/use-local-business-date', () => ({
  useLocalBusinessDate: () => '2026-10-09',
}));
jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const session = {
      state: {
        status: 'unlocked',
        ownerId: 'owner-1',
        deviceLocale: { timeZone: 'Asia/Kolkata' },
        snapshot: {
          settings: { language: 'en', currencyCode: 'INR', dateFormat: 'day-month-year' },
        },
      },
      getPhase2Repository: () => mockPhase2Repository,
      getPhase3Repository: () => mockPhase3Repository,
      getPhase4Repository: () => mockPhase4Repository,
    };
    return () => session;
  })(),
}));

const MEMBER: MemberRecord = {
  id: 'member-1',
  memberCode: 'GV-00001',
  name: 'Sachin',
  phone: '8005863655',
  email: 'sachin@example.com',
  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningSource: '',
  isArchived: false,
  hasPhoto: false,
  photo: null,
  notes: [{ id: 'note-1', content: 'Prefers morning sessions', createdAtUtc: '2026-10-08' }],
  audit: [],
  createdAtUtc: '2026-10-07T00:00:00.000Z',
  updatedAtUtc: '2026-10-09T00:00:00.000Z',
};

describe('MemberProfilePanel tabs', () => {
  it('switches between summary, plans, payments, and notes content', async () => {
    const screen = render(<MemberProfilePanel member={MEMBER} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('tab', { name: 'Summary' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByText('Member details')).toBeTruthy();
    expect(screen.queryByText('Financial ledger')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Plans (0)' }));
    expect(screen.getByText('Subscription timelines')).toBeTruthy();
    expect(screen.queryByText('Member details')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Payments' }));
    expect(screen.getByText('Financial ledger')).toBeTruthy();
    expect(screen.queryByText('Subscription timelines')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByText('Desk notes')).toBeTruthy();
    expect(screen.getByText('Prefers morning sessions')).toBeTruthy();
    expect(screen.queryByText('Financial ledger')).toBeNull();
  });
});
