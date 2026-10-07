import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { AppLanguage } from '@/i18n';
import en from '@/i18n/locales/en.json';
import hi from '@/i18n/locales/hi.json';

const resources = { en, hi } as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function devanagariFontBase64(): Promise<string> {
  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('BUNDLED_FONT_UNAVAILABLE');
  return new File(asset.localUri).base64();
}

export async function createBilingualPdf(language: AppLanguage): Promise<File> {
  const text = resources[language];
  const font = await devanagariFontBase64();
  const amount = new Intl.NumberFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(1250.5);
  const html = `<!doctype html>
  <html lang="${language}">
    <head>
      <meta charset="utf-8" />
      <style>
        @font-face { font-family: 'GymVitoNoto'; src: url(data:font/ttf;base64,${font}); }
        @page { size: A4; margin: 18mm; }
        body { font-family: 'GymVitoNoto', sans-serif; color: #102621; }
        .card { border: 2px solid #1f796b; border-radius: 16px; padding: 24px; }
        h1 { color: #0d594f; font-size: 28px; }
        p { font-size: 18px; line-height: 1.55; }
      </style>
    </head>
    <body><div class="card">
      <h1>${escapeHtml(text.pdfTitle)}</h1>
      <p><strong>${escapeHtml(text.memberLabel)}:</strong> साक्षी / Sakshi</p>
      <p><strong>${escapeHtml(text.amountLabel)}:</strong> ${escapeHtml(amount)}</p>
      <p>${escapeHtml(text.offlineNotice)}</p>
    </div></body>
  </html>`;
  const result = await Print.printToFileAsync({ html, base64: false });
  return new File(result.uri);
}

export async function sharePdf(pdf: File): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share GymVito PDF proof',
  });
  return true;
}

export async function printPdf(pdf: File): Promise<void> {
  await Print.printAsync({ uri: pdf.uri });
}

export function deleteTemporaryPdf(pdf: File): void {
  if (pdf.exists) pdf.delete();
}
