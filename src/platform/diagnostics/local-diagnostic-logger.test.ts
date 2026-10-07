import {
  clearLocalDiagnosticsForTests,
  logLocalDiagnostic,
  readLocalDiagnostics,
} from './local-diagnostic-logger';

describe('local diagnostics', () => {
  beforeEach(clearLocalDiagnosticsForTests);

  it('keeps only allow-listed diagnostic codes', () => {
    logLocalDiagnostic('error', 'STARTUP.DB_OPEN_FAILED');
    logLocalDiagnostic('error', 'owner@example.com');
    expect(readLocalDiagnostics().map(({ code }) => code)).toEqual([
      'STARTUP.DB_OPEN_FAILED',
      'REDACTED_DIAGNOSTIC',
    ]);
  });

  it('retains a bounded in-memory history with no remote destination', () => {
    for (let index = 0; index < 105; index += 1) logLocalDiagnostic('info', `CODE_${index}`);
    expect(readLocalDiagnostics()).toHaveLength(100);
    expect(readLocalDiagnostics()[0]?.code).toBe('CODE_5');
  });
});
