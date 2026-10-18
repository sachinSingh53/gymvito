import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function bundledDevanagariFontBase64(): Promise<string> {
  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('BUNDLED_FONT_UNAVAILABLE');
  return new File(asset.localUri).base64();
}

export type PdfShareResult = 'shared' | 'opened' | 'saved' | 'unavailable';

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

export function pdfShareFailureCode(error: unknown): string {
  const failures = (error as { failures?: unknown[] } | null)?.failures;
  if (!failures?.length) return nativeFailureCode(error);
  return failures.map(nativeFailureCode).join('__').slice(0, 180);
}

/**
 * Android share targets sometimes reject the PDF (`shareAsync` throws), so fall back to
 * opening it in a viewer and finally to saving it in a folder the owner picks.
 */
export async function sharePdf(
  pdf: File,
  title: string,
  fileName: string,
): Promise<PdfShareResult> {
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
        const destination = new File(directory, fileName.replace(/[^A-Za-z0-9_.-]/g, '-'));
        await pdf.copy(destination, { overwrite: true });
        return 'saved';
      } catch (saveError) {
        const combined = new Error('PDF_SHARE_FALLBACKS_FAILED') as Error & {
          failures: unknown[];
        };
        combined.failures = [error, openError, saveError];
        throw combined;
      }
    }
  }
}

export function deleteTemporaryPdf(pdf: File): void {
  try {
    if (pdf.exists) pdf.delete();
  } catch {
    // Temporary-file cleanup must never turn a completed print/share action into a failure.
  }
}
