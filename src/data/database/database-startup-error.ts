export type DatabaseStartupStage =
  | 'DATABASE_KEY_ACCESS_FAILED'
  | 'DATABASE_OPEN_FAILED'
  | 'DATABASE_CIPHER_CHECK_FAILED'
  | 'DATABASE_CIPHER_UNAVAILABLE'
  | 'DATABASE_KEY_APPLY_FAILED'
  | 'DATABASE_KEY_VERIFY_FAILED'
  | 'DATABASE_PRAGMA_CONFIG_FAILED'
  | 'DATABASE_APPLICATION_ID_FAILED'
  | 'DATABASE_VERSION_CHECK_FAILED'
  | 'DATABASE_MIGRATION_STATE_FAILED'
  | `DATABASE_MIGRATION_${number}_FAILED`
  | 'DATABASE_INTEGRITY_CHECK_FAILED'
  | 'DATABASE_FINAL_VERSION_FAILED';

export class DatabaseStartupError extends Error {
  constructor(
    readonly code: DatabaseStartupStage,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'DatabaseStartupError';
  }
}

export async function atDatabaseStartupStage<T>(
  code: DatabaseStartupStage,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DatabaseStartupError) throw error;
    throw new DatabaseStartupError(code, { cause: error });
  }
}

function deepestMessage(error: unknown): string {
  let current = error;
  let message = '';
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (current.message) message = current.message;
    current = current.cause;
  }
  return message;
}

export type StartupDiagnostic = Readonly<{ code: string; detail?: string }>;

export function startupDiagnostic(error: unknown): StartupDiagnostic {
  const code =
    error instanceof DatabaseStartupError
      ? error.code
      : error instanceof Error
        ? error.message
            .replace(/[^A-Za-z0-9_.-]/g, '_')
            .toUpperCase()
            .slice(0, 80) || 'SESSION_UNKNOWN_ERROR'
        : 'SESSION_UNKNOWN_ERROR';

  let detail = deepestMessage(error);
  const causedBy = detail.lastIndexOf('Caused by:');
  if (causedBy >= 0) detail = detail.slice(causedBy + 'Caused by:'.length);
  detail = detail
    .replace(/PRAGMA\s+key\s*=\s*[^;]+/gi, 'PRAGMA key = [REDACTED]')
    .replace(/\b[0-9a-f]{64,}\b/gi, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);

  return detail && detail !== code ? { code, detail } : { code };
}
