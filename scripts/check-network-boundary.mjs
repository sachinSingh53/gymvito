import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const sourceRoot = join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const forbidden = [
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/from\s+['"](?:axios|firebase|@supabase\/|@apollo\/|@tanstack\/react-query)/, 'network client'],
];

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const violations = [];
for (const path of files(sourceRoot).filter((file) => sourceExtensions.has(extname(file)))) {
  const content = readFileSync(path, 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(content)) violations.push(`${relative(root, path)}: forbidden ${label}`);
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Network boundary valid: no direct runtime client found.');
