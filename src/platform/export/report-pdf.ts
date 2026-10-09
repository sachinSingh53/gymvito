import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type PrintableReport = Readonly<{
  title: string;
  gymName: string;
  generatedLabel: string;
  generatedValue: string;
  timeZoneLabel: string;
  timeZone: string;
  filtersLabel: string;
  filters: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}>;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

async function fontBase64(): Promise<string> {
  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('BUNDLED_FONT_UNAVAILABLE');
  return new File(asset.localUri).base64();
}

export async function createReportPdf(report: PrintableReport): Promise<File> {
  const font = await fontBase64();
  const headings = report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const body = report.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:GymVito;src:url(data:font/ttf;base64,${font})}
    @page{size:A4 landscape;margin:14mm}body{font-family:GymVito,sans-serif;color:#162d29}
    h1{color:#004c42;margin:0 0 6px}.meta{color:#526963;font-size:11px;margin:2px 0 14px}
    table{width:100%;border-collapse:collapse;font-size:10px}th{background:#dff9f3;text-align:left}
    th,td{border:1px solid #dcece7;padding:7px;vertical-align:top}tr:nth-child(even){background:#f4fbf8}
  </style></head><body><h1>${escapeHtml(report.title)}</h1><div>${escapeHtml(report.gymName)}</div>
  <div class="meta">${escapeHtml(report.generatedLabel)}: ${escapeHtml(report.generatedValue)} · ${escapeHtml(report.timeZoneLabel)}: ${escapeHtml(report.timeZone)}<br>${escapeHtml(report.filtersLabel)}: ${escapeHtml(report.filters)}</div>
  <table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const result = await Print.printToFileAsync({ html, base64: false });
  return new File(result.uri);
}

export async function shareReportPdf(file: File, title: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: title });
  return true;
}

export function deleteTemporaryReport(file: File): void {
  if (file.exists) file.delete();
}
