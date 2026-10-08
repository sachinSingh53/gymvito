import { buildReceiptHtml } from './receipt';

const receipt = {
  language: 'en' as const,
  currencyCode: 'INR',
  gymName: 'Strong & Safe <Gym>',
  gymAddress: 'Mumbai',
  gymPhone: '+91 90000 00000',
  receiptFooter: 'Thank you',
  receiptNumber: 'REC-000042',
  invoiceNumber: 'INV-000009',
  memberName: 'Amit Sharma',
  memberCode: 'GV-082',
  planName: 'Annual Strength',
  amountMinor: 2_500_00,
  methodLabel: 'UPI / QR',
  transactionReference: 'UTR-123',
  receivedAtLabel: '8 Oct 2026, 10:00 am',
  invoiceTotalMinor: 18_000_00,
  paidTotalMinor: 18_000_00,
  balanceMinor: 0,
  duplicate: false,
};

describe('receipt HTML', () => {
  it('reconciles receipt amounts and escapes all user values', () => {
    const html = buildReceiptHtml(receipt);
    expect(html).toContain('₹2,500.00');
    expect(html).toContain('₹18,000.00');
    expect(html).toContain('₹0.00');
    expect(html).toContain('Strong &amp; Safe &lt;Gym&gt;');
    expect(html).not.toContain('Strong & Safe <Gym>');
    expect(html).toContain('does not claim payment processing or bank settlement');
  });

  it('marks regenerated copies visibly and supports Hindi copy', () => {
    const html = buildReceiptHtml({ ...receipt, language: 'hi', duplicate: true });
    expect(html).toContain('डुप्लिकेट प्रति');
    expect(html).toContain('दर्ज भुगतान रसीद');
  });
});
