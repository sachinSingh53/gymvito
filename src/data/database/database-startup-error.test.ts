import {
  atDatabaseStartupStage,
  DatabaseStartupError,
  startupDiagnostic,
} from './database-startup-error';

describe('database startup diagnostics', () => {
  it('retains the failing stage and the deepest native cause', async () => {
    const native = new Error(
      "Call to function 'NativeDatabase.execAsync' has been rejected. Caused by: SQLite error 26: file is not a database",
    );

    await expect(
      atDatabaseStartupStage('DATABASE_KEY_VERIFY_FAILED', async () => {
        throw native;
      }),
    ).rejects.toMatchObject({ code: 'DATABASE_KEY_VERIFY_FAILED', cause: native });

    const wrapped = new DatabaseStartupError('DATABASE_KEY_VERIFY_FAILED', { cause: native });
    expect(startupDiagnostic(wrapped)).toEqual({
      code: 'DATABASE_KEY_VERIFY_FAILED',
      detail: 'SQLite error 26: file is not a database',
    });
  });

  it('redacts raw database keys from diagnostic details', () => {
    const key = 'a'.repeat(64);
    const error = new DatabaseStartupError('DATABASE_KEY_APPLY_FAILED', {
      cause: new Error(`PRAGMA key = "x'${key}'"; failed for ${key}`),
    });

    const diagnostic = startupDiagnostic(error);
    expect(diagnostic.detail).toBe('PRAGMA key = [REDACTED]; failed for [REDACTED]');
    expect(diagnostic.detail).not.toContain(key);
  });
});
