import type { AppLanguage } from '@/domain/onboarding/onboarding';

export type ReceiptDocument = Readonly<{
  language: AppLanguage;
  currencyCode: string;
  gymName: string;
  gymAddress: string;
  gymPhone: string;
  receiptFooter: string;
  receiptNumber: string;
  invoiceNumber: string;
  memberName: string;
  memberCode: string;
  planName: string;
  amountMinor: number;
  methodLabel: string;
  transactionReference: string;
  receivedAtLabel: string;
  invoiceTotalMinor: number;
  paidTotalMinor: number;
  balanceMinor: number;
  duplicate: boolean;
}>;

export function escapeReceiptHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildReceiptHtml(document: ReceiptDocument, fontBase64 = ''): string {
  const hi = document.language === 'hi';
  const money = (minor: number) =>
    new Intl.NumberFormat(hi ? 'hi-IN' : 'en-IN', {
      style: 'currency',
      currency: document.currencyCode,
    }).format(minor / 100);
  const e = escapeReceiptHtml;
  const title = hi ? 'दर्ज भुगतान रसीद' : 'Recorded payment receipt';
  const duplicate = hi ? 'डुप्लिकेट प्रति' : 'DUPLICATE COPY';
  const rows: [string, string][] = [
    [hi ? 'सदस्य' : 'Member', `${document.memberName} • ${document.memberCode}`],
    [hi ? 'प्लान' : 'Plan', document.planName],
    [hi ? 'भुगतान माध्यम' : 'Recorded method', document.methodLabel],
    [hi ? 'दर्ज समय' : 'Recorded at', document.receivedAtLabel],
    [hi ? 'इनवॉइस' : 'Invoice', document.invoiceNumber],
    [hi ? 'इनवॉइस कुल' : 'Invoice total', money(document.invoiceTotalMinor)],
    [hi ? 'कुल दर्ज भुगतान' : 'Total recorded paid', money(document.paidTotalMinor)],
    [hi ? 'बकाया' : 'Balance due', money(document.balanceMinor)],
  ];
  if (document.transactionReference) {
    rows.splice(4, 0, [
      hi ? 'लेनदेन संदर्भ' : 'Transaction reference',
      document.transactionReference,
    ]);
  }
  return `<!doctype html><html lang="${document.language}"><head><meta charset="utf-8" /><style>
    ${fontBase64 ? `@font-face{font-family:GymVitoNoto;src:url(data:font/ttf;base64,${fontBase64})}` : ''}
    @page{size:A4;margin:16mm}body{font-family:GymVitoNoto,Inter,sans-serif;color:#162d29;margin:0}
    .sheet{border:1px solid #dcece7;border-radius:14px;padding:24px}.brand{color:#0d6659;font-size:13px;font-weight:700;letter-spacing:1.5px}
    h1{font-size:26px;margin:8px 0 2px}.muted{color:#526963}.duplicate{display:inline-block;margin:12px 0;padding:6px 10px;border:2px solid #a92e2e;color:#a92e2e;font-weight:700}
    .amount{background:#e6f5f0;border-radius:12px;margin:20px 0;padding:18px}.amount small{display:block}.amount strong{font-size:30px;color:#004c42}
    table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #dcece7;padding:10px 0;vertical-align:top}td:first-child{color:#526963;width:42%}td:last-child{text-align:right;font-weight:600}
    footer{margin-top:24px;border-top:1px solid #dcece7;padding-top:14px;color:#526963;font-size:12px}.notice{font-weight:700;color:#0d4732}
  </style></head><body><main class="sheet"><div class="brand">GYMVITO • LOCAL LEDGER</div><h1>${e(document.gymName)}</h1>
    <div class="muted">${e([document.gymAddress, document.gymPhone].filter(Boolean).join(' • '))}</div>
    <h2>${title}</h2><div class="muted">${e(document.receiptNumber)}</div>${document.duplicate ? `<div class="duplicate">${duplicate}</div>` : ''}
    <div class="amount"><small>${hi ? 'दर्ज राशि' : 'Recorded amount'}</small><strong>${e(money(document.amountMinor))}</strong></div>
    <table>${rows.map(([label, value]) => `<tr><td>${e(label)}</td><td>${e(value)}</td></tr>`).join('')}</table>
    <footer><div class="notice">${hi ? 'यह रसीद स्थानीय रिकॉर्ड है; भुगतान प्रोसेसिंग या बैंक निपटान का दावा नहीं है।' : 'This is a local recorded-payment receipt; it does not claim payment processing or bank settlement.'}</div>
    ${document.receiptFooter ? `<p>${e(document.receiptFooter)}</p>` : ''}<p>${title} • ${e(document.receiptNumber)}</p></footer></main></body></html>`;
}
