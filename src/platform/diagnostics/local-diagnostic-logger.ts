export type DiagnosticLevel = 'info' | 'warning' | 'error';

export type DiagnosticEntry = Readonly<{
  occurredAtUtc: string;
  level: DiagnosticLevel;
  code: string;
}>;

const MAX_ENTRIES = 100;
const entries: DiagnosticEntry[] = [];

function safeCode(code: string): string {
  return /^[A-Z0-9_.-]{1,80}$/.test(code) ? code : 'REDACTED_DIAGNOSTIC';
}

export function logLocalDiagnostic(level: DiagnosticLevel, code: string): void {
  entries.push({ occurredAtUtc: new Date().toISOString(), level, code: safeCode(code) });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function readLocalDiagnostics(): readonly DiagnosticEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export function clearLocalDiagnosticsForTests(): void {
  entries.length = 0;
}
