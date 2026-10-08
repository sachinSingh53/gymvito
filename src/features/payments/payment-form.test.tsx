import { act, fireEvent, render, type RenderAPI, waitFor } from '@testing-library/react-native';

import '@/i18n';

import type { InvoiceRecord } from '@/data/repositories/phase4-repository';

import { PaymentForm } from './payment-form';

const mockReplace = jest.fn();
const mockRecordPayment = jest.fn();

jest.mock('expo-crypto', () => ({ randomUUID: () => 'payment-operation-1' }));
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));
jest.mock('@/features/memberships/use-local-business-date', () => ({
  useLocalBusinessDate: () => '2026-10-08',
}));

const mockInvoice: InvoiceRecord = {
  id: 'invoice-1',
  operationId: 'invoice:membership-1',
  invoiceNumber: 'INV-000001',
  memberId: 'member-1',
  memberName: 'Amit Sharma',
  memberCode: 'GV-00001',
  memberPhone: '+91 98201 44521',
  membershipId: 'membership-1',
  planName: 'Annual Strength',
  currencyCode: 'INR',
  subtotalMinor: 180_000,
  admissionFeeMinor: 0,
  discountMinor: 0,
  taxLabel: '',
  taxRateBasisPoints: 0,
  taxMinor: 0,
  totalMinor: 180_000,
  paidMinor: 155_000,
  adjustmentMinor: 0,
  balanceMinor: 25_000,
  status: 'partially-paid',
  dueDate: '2026-10-07',
  dueStatus: 'overdue',
  finalizedAtUtc: '2026-10-01T00:00:00.000Z',
  createdByStaffId: 'owner',
};

jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const phase2 = {
      getMember: async () => ({
        id: 'member-1',
        memberCode: 'GV-00001',
        name: 'Amit Sharma',
        phone: '+91 98201 44521',
      }),
    };
    const phase4 = {
      listMemberInvoices: async () => [mockInvoice],
      listOutstandingInvoices: async () => [mockInvoice],
      getBillingSettings: async () => ({
        invoicePrefix: 'INV',
        receiptPrefix: 'REC',
        paymentMethods: [
          { code: 'upi', label: 'UPI / QR', isActive: true, sortOrder: 10 },
          { code: 'cash', label: 'Cash', isActive: true, sortOrder: 20 },
          { code: 'card', label: 'Card / POS', isActive: true, sortOrder: 30 },
          { code: 'bank-transfer', label: 'Bank transfer', isActive: true, sortOrder: 40 },
          { code: 'cheque', label: 'Cheque', isActive: true, sortOrder: 50 },
          { code: 'other', label: 'Other', isActive: true, sortOrder: 60 },
        ],
      }),
      recordPayment: (...args: unknown[]) => mockRecordPayment(...args),
    };
    const session = {
      state: {
        status: 'unlocked',
        ownerId: 'owner',
        deviceLocale: { timeZone: 'Asia/Kolkata' },
        snapshot: {
          settings: {
            language: 'en',
            currencyCode: 'INR',
            dateFormat: 'day-month-year',
          },
        },
      },
      getPhase2Repository: () => phase2,
      getPhase4Repository: () => phase4,
    };
    return () => session;
  })(),
}));

describe('PaymentForm', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRecordPayment.mockReset();
    mockRecordPayment.mockResolvedValue({ id: 'payment-1' });
  });

  async function renderForm(): Promise<RenderAPI> {
    const screen = render(<PaymentForm invoiceId="invoice-1" memberId="member-1" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return screen;
  }

  it('renders the approved due, quick amount, and recorded-method hierarchy', async () => {
    const screen = await renderForm();

    expect(await screen.findByText('Amit Sharma')).toBeTruthy();
    expect(screen.getByText('Outstanding balance')).toBeTruthy();
    expect(screen.getByText('₹250.00')).toBeTruthy();
    expect(screen.getByText('UPI / QR')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Card / POS')).toBeTruthy();
    expect(screen.getByText('Bank transfer')).toBeTruthy();
    expect(screen.getByText('Record payment and issue receipt')).toBeTruthy();
  });

  it('records an exact minor-unit amount and opens the new receipt', async () => {
    const screen = await renderForm();
    await screen.findByText('Amit Sharma');
    const submitButton = screen.getByRole('button', {
      name: 'Record payment and issue receipt',
    });
    expect(submitButton.props.accessibilityState).toEqual({ disabled: false });
    await act(async () => {
      fireEvent.press(submitButton);
    });

    await waitFor(() =>
      expect(mockRecordPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'payment-operation-1',
          invoiceId: 'invoice-1',
          amountMinor: 25_000,
          methodCode: 'upi',
          methodLabel: 'UPI / QR',
          receivedLocalDate: '2026-10-08',
        }),
        'owner',
        '2026-10-08',
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/invoice/invoice-1?receipt=payment-1&issued=1');
  });

  it('blocks overpayment before any repository write', async () => {
    const screen = await renderForm();
    await screen.findByText('Amit Sharma');
    fireEvent.changeText(screen.getByLabelText('Recorded payment amount'), '250.01');
    fireEvent.press(screen.getByRole('button', { name: 'Record payment and issue receipt' }));

    expect(
      await screen.findByText('The amount cannot exceed the outstanding balance.'),
    ).toBeTruthy();
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });
});
