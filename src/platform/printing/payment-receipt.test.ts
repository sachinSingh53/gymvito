import {
  deletePaymentReceipt,
  paymentReceiptShareFailureCode,
  receiptFontBase64,
} from './payment-receipt';

jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-print', () => ({ printAsync: jest.fn(), printToFileAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;

    constructor(parent: { uri?: string } | string, name?: string) {
      this.uri = name
        ? `${typeof parent === 'string' ? parent : parent.uri}${name}`
        : String(parent);
    }
  },
  Paths: { cache: { uri: 'file:///cache/' } },
}));

describe('payment receipt sharing', () => {
  it('creates English receipts without loading the Devanagari font asset', async () => {
    const loadFont = jest.fn().mockResolvedValue('font-base64');

    await expect(receiptFontBase64('en', loadFont)).resolves.toBe('');

    expect(loadFont).not.toHaveBeenCalled();
  });

  it('does not report best-effort temporary cleanup failures', () => {
    const pdf = {
      get exists() {
        throw new Error('file is still in use');
      },
    };

    expect(() => deletePaymentReceipt(pdf as never)).not.toThrow();
  });

  it('reduces native fallback failures to a safe visible diagnostic code', () => {
    const error = Object.assign(new Error('fallbacks failed'), {
      failures: [
        { code: 'ERR_SHARING' },
        new Error('No Activity found'),
        { code: 'ERR_REQUEST_CANCELLED' },
      ],
    });

    expect(paymentReceiptShareFailureCode(error)).toBe(
      'ERR_SHARING__NO_ACTIVITY_FOUND__ERR_REQUEST_CANCELLED',
    );
  });
});
