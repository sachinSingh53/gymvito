import { reportFontBase64, type PrintableReport } from './report-pdf';

jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class MockFile {},
  Directory: class MockDirectory {},
}));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const report = (rows: readonly (readonly string[])[]): PrintableReport => ({
  title: 'Member reports',
  gymName: 'GymVito',
  generatedLabel: 'Generated',
  generatedValue: '18 Oct 2026',
  timeZoneLabel: 'Time zone',
  timeZone: 'Asia/Kolkata',
  filtersLabel: 'Filters',
  filters: '2026-09-19 — 2026-10-18',
  columns: ['Code', 'Member'],
  rows,
});

describe('report PDF font', () => {
  it('skips the bundled font when the report has no Devanagari text', async () => {
    const loadFont = jest.fn().mockResolvedValue('font-base64');

    await expect(reportFontBase64(report([['GV-00013', 'Bala']]), loadFont)).resolves.toBe('');

    expect(loadFont).not.toHaveBeenCalled();
  });

  it('embeds the bundled font for Devanagari member names', async () => {
    const loadFont = jest.fn().mockResolvedValue('font-base64');

    await expect(reportFontBase64(report([['GV-00014', 'भोला']]), loadFont)).resolves.toBe(
      'font-base64',
    );
  });

  it('falls back to the system font when the bundled font cannot load', async () => {
    const loadFont = jest.fn().mockRejectedValue(new Error('BUNDLED_FONT_UNAVAILABLE'));

    await expect(reportFontBase64(report([['GV-00014', 'भोला']]), loadFont)).resolves.toBe('');
  });
});
