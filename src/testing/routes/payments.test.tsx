import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { FlatList } from 'react-native';

import PaymentsRoute, { PAYMENT_PAGE_SIZE } from '@/app/(app)/payments';
import type { InvoiceRecord, PaymentRecord } from '@/data/repositories/phase4-repository';
import i18n from '@/i18n';

const mockParams: { filter?: string } = {};
const mockRepository = {
  listOutstandingInvoices: jest.fn(),
  getPaymentSummary: jest.fn(),
  listPaymentsPage: jest.fn(),
};

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/features/memberships/use-local-business-date', () => ({
  useLocalBusinessDate: () => '2026-10-08',
}));

jest.mock('@/features/session/app-session-context', () => {
  // The real session hands out stable callbacks; a fresh one per render would reload forever.
  const session = {
    state: {
      status: 'unlocked',
      ownerName: 'Owner',
      deviceLocale: { timeZone: 'Asia/Kolkata' },
      snapshot: { settings: { language: 'en', currencyCode: 'INR', dateFormat: 'day-month-year' } },
    },
    changeLanguage: jest.fn(),
    getPhase4Repository: () => mockRepository,
  };
  return { useAppSession: () => session };
});

function payment(index: number, day = '2026-10-08'): PaymentRecord {
  return {
    id: `payment-${index}`,
    operationId: `op-${index}`,
    receiptNumber: `REC-${String(index).padStart(6, '0')}`,
    invoiceId: `invoice-${index}`,
    invoiceNumber: `INV-${index}`,
    memberId: `member-${index}`,
    memberName: `Member ${index}`,
    amountMinor: 50_000,
    currencyCode: 'INR',
    methodCode: 'upi',
    methodLabel: 'UPI / QR',
    transactionReference: '',
    note: '',
    receivedAtUtc: `${day}T05:00:00.000Z`,
    receivedLocalDate: day as PaymentRecord['receivedLocalDate'],
    actorStaffId: 'owner',
    state: 'recorded',
  };
}

const OVERDUE_INVOICE = {
  id: 'invoice-overdue',
  invoiceNumber: 'INV-000009',
  memberName: 'Ravi Kumar',
  planName: 'Monthly',
  dueDate: '2026-10-01',
  dueStatus: 'overdue',
  balanceMinor: 120_000,
} as unknown as InvoiceRecord;

describe('PaymentsRoute', () => {
  beforeEach(async () => {
    delete mockParams.filter;
    jest.mocked(router.push).mockClear();
    mockRepository.listOutstandingInvoices.mockReset().mockResolvedValue([OVERDUE_INVOICE]);
    mockRepository.getPaymentSummary
      .mockReset()
      .mockResolvedValue({ totalCount: 3, todayCount: 2, todayRecordedMinor: 100_000 });
    mockRepository.listPaymentsPage.mockReset();
    await act(async () => i18n.changeLanguage('en'));
  });

  it('summarises dues and groups outstanding invoices by status', async () => {
    mockRepository.listPaymentsPage.mockResolvedValue({ payments: [], nextCursor: null });
    const screen = render(<PaymentsRoute />);

    expect(await screen.findByText('Ravi Kumar')).toBeTruthy();
    expect(screen.getAllByText('₹1,200.00').length).toBeGreaterThan(0);
    expect(screen.getByText('1 open invoices • 1 overdue')).toBeTruthy();
    expect(screen.getByText('₹1,000.00')).toBeTruthy();
    expect(screen.getByRole('header', { name: /Overdue/ })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /Ravi Kumar/ }));
    expect(router.push).toHaveBeenCalledWith('/invoice/invoice-overdue');
  });

  it('loads the next page of payment history when the list nears its end', async () => {
    mockParams.filter = 'payments';
    const cursor = { receivedAtUtc: '2026-10-08T05:00:00.000Z', id: 'payment-2' };
    mockRepository.listPaymentsPage
      .mockResolvedValueOnce({ payments: [payment(1), payment(2)], nextCursor: cursor })
      .mockResolvedValueOnce({ payments: [payment(3, '2026-10-07')], nextCursor: null });
    const screen = render(<PaymentsRoute />);

    expect(await screen.findByText('Member 2')).toBeTruthy();
    expect(screen.queryByText('Member 3')).toBeNull();
    expect(mockRepository.listPaymentsPage).toHaveBeenLastCalledWith({
      limit: PAYMENT_PAGE_SIZE,
      receivedLocalDate: undefined,
    });

    await act(async () => screen.UNSAFE_getByType(FlatList).props.onEndReached());

    expect(await screen.findByText('Member 3')).toBeTruthy();
    expect(mockRepository.listPaymentsPage).toHaveBeenLastCalledWith({
      limit: PAYMENT_PAGE_SIZE,
      after: cursor,
      receivedLocalDate: undefined,
    });
    expect(screen.getByRole('header', { name: /Today/ })).toBeTruthy();
    expect(screen.getByRole('header', { name: /Yesterday/ })).toBeTruthy();
    expect(screen.getByText('All 3 payments shown')).toBeTruthy();

    // Nothing is left to read, so reaching the end again does not query.
    await act(async () => screen.UNSAFE_getByType(FlatList).props.onEndReached());
    expect(mockRepository.listPaymentsPage).toHaveBeenCalledTimes(2);
  });

  it('filters payment history to today from the home shortcut', async () => {
    mockParams.filter = 'today';
    mockRepository.listPaymentsPage.mockResolvedValue({ payments: [], nextCursor: null });
    const screen = render(<PaymentsRoute />);

    expect(await screen.findByText('No payments recorded today.')).toBeTruthy();
    expect(mockRepository.listPaymentsPage).toHaveBeenCalledWith({
      limit: PAYMENT_PAGE_SIZE,
      receivedLocalDate: '2026-10-08',
    });
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Today/ }).props.accessibilityState).toEqual({
        selected: true,
      }),
    );
  });
});
