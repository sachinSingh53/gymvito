import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildReceiptHtml, type ReceiptDocument } from '@/domain/billing/receipt';

async function bundledFontBase64(): Promise<string> {
  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('BUNDLED_FONT_UNAVAILABLE');
  return new File(asset.localUri).base64();
}

export async function createPaymentReceiptPdf(document: ReceiptDocument): Promise<File> {
  const html = buildReceiptHtml(document, await bundledFontBase64());
  const result = await Print.printToFileAsync({ html, base64: false });
  return new File(result.uri);
}

export async function sharePaymentReceipt(pdf: File, title: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', dialogTitle: title });
  return true;
}

export async function printPaymentReceipt(pdf: File): Promise<void> {
  await Print.printAsync({ uri: pdf.uri });
}

export function deletePaymentReceipt(pdf: File): void {
  if (pdf.exists) pdf.delete();
}
