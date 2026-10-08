import { act, fireEvent, render, type RenderAPI, waitFor } from '@testing-library/react-native';

import '@/i18n';

import type { PlanRecord } from '@/data/repositories/phase2-repository';
import type { MembershipPreview } from '@/data/repositories/phase3-repository';

import { MembershipForm } from './membership-form';

const mockReplace = jest.fn();
const mockFinalize = jest.fn();

const plan: PlanRecord = {
  id: 'plan-1',
  name: 'Annual Strength',
  description: 'Full gym access',
  durationValue: 1,
  durationUnit: 'year',
  priceMinor: 100_000,
  admissionFeeMinor: 0,
  currencyCode: 'INR',
  taxLabel: 'GST',
  taxRateBasisPoints: 1_800,
  discountType: 'none',
  discountValue: 0,
  colorHex: '#0D6659',
  freezeAllowed: false,
  maxFreezeDays: null,
  freezeExtendsEndDate: false,
  renewalBehavior: 'after-expiry',
  isActive: true,
  createdAtUtc: '2026-10-08T00:00:00.000Z',
  updatedAtUtc: '2026-10-08T00:00:00.000Z',
};

const preview: MembershipPreview = {
  memberId: 'member-1',
  plan,
  startDate: '2026-10-08',
  endDate: '2027-10-07',
  charges: {
    priceMinor: 100_000,
    admissionFeeMinor: 0,
    discountMinor: 0,
    taxableMinor: 100_000,
    taxMinor: 18_000,
    totalMinor: 118_000,
  },
  status: 'active',
  priorMembershipId: null,
  overlaps: [],
  hasOverrides: false,
};

jest.mock('expo-crypto', () => ({ randomUUID: () => 'enrollment-operation-1' }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));
jest.mock('./use-local-business-date', () => ({
  useLocalBusinessDate: () => '2026-10-08',
}));
jest.mock('@/features/session/app-session-context', () => ({
  useAppSession: (() => {
    const phase2 = { listPlans: async () => [plan] };
    const phase3 = {
      listMemberships: async () => [],
      previewMembership: async () => preview,
    };
    const phase4 = {
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
      finalizeMembershipWithBilling: (...args: unknown[]) => mockFinalize(...args),
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
      getPhase3Repository: () => phase3,
      getPhase4Repository: () => phase4,
    };
    return () => session;
  })(),
}));

describe('MembershipForm Phase 4 billing', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockFinalize.mockReset();
    mockFinalize.mockResolvedValue({
      membership: { id: 'membership-1' },
      invoice: { id: 'invoice-1' },
      payment: { id: 'payment-1' },
    });
  });

  async function renderForm(): Promise<RenderAPI> {
    const screen = render(<MembershipForm memberId="member-1" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return screen;
  }

  it('atomically includes an optional partial payment and routes to its receipt', async () => {
    const screen = await renderForm();

    expect(await screen.findByText('Projected charge breakdown')).toBeTruthy();
    fireEvent(screen.getByLabelText('Record payment now'), 'valueChange', true);
    fireEvent.changeText(screen.getByLabelText('Initial recorded payment amount'), '500.00');
    fireEvent.press(screen.getByRole('radio', { name: 'Cash' }));
    fireEvent.changeText(
      screen.getByLabelText('Transaction reference / UTR (optional)'),
      'COUNTER-42',
    );
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Confirm enrollment' }));
    });

    await waitFor(() =>
      expect(mockFinalize).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'enrollment-operation-1',
          memberId: 'member-1',
          planId: 'plan-1',
        }),
        'owner',
        '2026-10-08',
        '2026-10-08',
        expect.objectContaining({
          operationId: 'payment:enrollment-operation-1',
          amountMinor: 50_000,
          methodCode: 'cash',
          methodLabel: 'Cash',
          transactionReference: 'COUNTER-42',
          receivedLocalDate: '2026-10-08',
        }),
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/invoice/invoice-1?receipt=payment-1&issued=1');
  });
});
