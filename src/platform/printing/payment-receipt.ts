import { File } from 'expo-file-system';
import * as Print from 'expo-print';

import { buildReceiptHtml, type ReceiptDocument } from '@/domain/billing/receipt';
import {
  bundledDevanagariFontBase64,
  deleteTemporaryPdf,
  pdfShareFailureCode,
  sharePdf,
  type PdfShareResult,
} from '@/platform/printing/share-pdf';

export async function receiptFontBase64(
  language: ReceiptDocument['language'],
  loadFont: () => Promise<string> = bundledDevanagariFontBase64,
): Promise<string> {
  return language === 'hi' ? loadFont() : '';
}

export async function createPaymentReceiptPdf(document: ReceiptDocument): Promise<File> {
  const fontBase64 = await receiptFontBase64(document.language);
  const html = buildReceiptHtml(document, fontBase64);
  const result = await Print.printToFileAsync({ html, base64: false });
  return new File(result.uri);
}

export type PaymentReceiptShareResult = PdfShareResult;

export const paymentReceiptShareFailureCode = pdfShareFailureCode;

export function sharePaymentReceipt(
  pdf: File,
  title: string,
  receiptNumber: string,
): Promise<PaymentReceiptShareResult> {
  return sharePdf(pdf, title, `GymVito-${receiptNumber}.pdf`);
}

export async function printPaymentReceipt(pdf: File): Promise<void> {
  await Print.printAsync({ uri: pdf.uri });
}

export const deletePaymentReceipt = deleteTemporaryPdf;
