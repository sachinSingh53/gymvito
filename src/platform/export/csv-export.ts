import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ExportDataset, ExportTable } from '@/data/repositories/phase6-repository';

export type ExportProgress = Readonly<{ completed: number; total: number }>;

const FORMULA_PREFIX = /^\s*[=+\-@]/;

export function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const protectedValue = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export async function serializeCsv(
  table: ExportTable,
  options: { signal?: AbortSignal; onProgress?: (progress: ExportProgress) => void } = {},
): Promise<string> {
  const lines = [`\uFEFF${table.headers.map(csvCell).join(',')}`];
  const total = table.rows.length;
  for (let index = 0; index < total; index += 1) {
    if (options.signal?.aborted) throw new Error('EXPORT_CANCELLED');
    lines.push(table.rows[index]!.map(csvCell).join(','));
    if ((index + 1) % 200 === 0 || index + 1 === total) {
      options.onProgress?.({ completed: index + 1, total });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  if (!total) options.onProgress?.({ completed: 0, total: 0 });
  return `${lines.join('\r\n')}\r\n`;
}

export async function createTemporaryCsv(
  dataset: ExportDataset,
  table: ExportTable,
  options: { signal?: AbortSignal; onProgress?: (progress: ExportProgress) => void } = {},
): Promise<File> {
  const csv = await serializeCsv(table, options);
  if (options.signal?.aborted) throw new Error('EXPORT_CANCELLED');
  const file = new File(Paths.cache, `gymvito-${dataset}-${Date.now()}.csv`);
  file.create({ overwrite: true });
  file.write(csv);
  return file;
}

export async function shareTemporaryExport(file: File, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle,
    UTI: 'public.comma-separated-values-text',
  });
  return true;
}

export function deleteTemporaryExport(file: File): void {
  if (file.exists) file.delete();
}
