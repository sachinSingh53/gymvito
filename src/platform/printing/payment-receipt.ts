import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { buildReceiptHtml, type ReceiptDocument } from '@/domain/billing/receipt';

async function bundledFontBase64(): Promise<string> {
  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('BUNDLED_FONT_UNAVAILABLE');
  return new File(asset.localUri).base64();
}

export async function receiptFontBase64(
  language: ReceiptDocument['language'],
  loadFont: () => Promise<string> = bundledFontBase64,
): Promise<string> {
  return language === 'hi' ? loadFont() : '';
}

export async function createPaymentReceiptPdf(document: ReceiptDocument): Promise<File> {
  const fontBase64 = await receiptFontBase64(document.language);
  const html = buildReceiptHtml(document, fontBase64);
  const result = await Print.printToFileAsync({ html, base64: false });
  return new File(result.uri);
}

export type PaymentReceiptShareResult = 'shared' | 'opened' | 'saved' | 'unavailable';

function nativeFailureCode(error: unknown): string {
  const coded = error as { code?: unknown; message?: unknown } | null;
  const detail =
    (typeof coded?.code === 'string' && coded.code) ||
    (typeof coded?.message === 'string' && coded.message) ||
    'UNKNOWN';
  return detail
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function paymentReceiptShareFailureCode(error: unknown): string {
  const failures = (error as { failures?: unknown[] } | null)?.failures;
  if (!failures?.length) return nativeFailureCode(error);
  return failures.map(nativeFailureCode).join('__').slice(0, 180);
}

export async function sharePaymentReceipt(
  pdf: File,
  title: string,
  receiptNumber: string,
): Promise<PaymentReceiptShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  try {
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
    return 'shared';
  } catch (error) {
    if (Platform.OS !== 'android') throw error;
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: pdf.contentUri,
        type: 'application/pdf',
        flags: 1,
      });
      return 'opened';
    } catch (openError) {
      try {
        const directory = await Directory.pickDirectoryAsync();
        const safeReceiptNumber = receiptNumber.replace(/[^A-Za-z0-9_-]/g, '-');
        const destination = new File(directory, `GymVito-${safeReceiptNumber}.pdf`);
        await pdf.copy(destination, { overwrite: true });
        return 'saved';
      } catch (saveError) {
        const combined = new Error('RECEIPT_SHARE_FALLBACKS_FAILED') as Error & {
          failures: unknown[];
        };
        combined.failures = [error, openError, saveError];
        throw combined;
      }
    }
  }
}

export async function printPaymentReceipt(pdf: File): Promise<void> {
  await Print.printAsync({ uri: pdf.uri });
}

export function deletePaymentReceipt(pdf: File): void {
  try {
    if (pdf.exists) pdf.delete();
  } catch {
    // Temporary-file cleanup must never turn a completed print/share action into a failure.
  }
}
