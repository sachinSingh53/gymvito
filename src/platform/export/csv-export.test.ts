import { csvCell, serializeCsv } from './csv-export';

describe('CSV export', () => {
  it('quotes multilingual content, commas, quotes, and newlines as UTF-8 CSV', async () => {
    const csv = await serializeCsv({
      headers: ['name', 'note'],
      rows: [['साक्षी, Sakshi', 'Line one\n"Line two"']],
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"साक्षी, Sakshi"');
    expect(csv).toContain('"Line one\n""Line two"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it.each(['=SUM(A1:A2)', '+441234', '-2+3', '@IMPORTXML(A1)', '  =1+1'])(
    'neutralizes spreadsheet formula input %s',
    (value) => expect(csvCell(value)).toBe(`"'${value}"`),
  );

  it('preserves leading zero text and supports cancellation between chunks', async () => {
    expect(csvCell('00123')).toBe('"00123"');
    const controller = new AbortController();
    controller.abort();
    await expect(
      serializeCsv({ headers: ['id'], rows: [['1']] }, { signal: controller.signal }),
    ).rejects.toThrow('EXPORT_CANCELLED');
  });
});
