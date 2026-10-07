import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const sourceRoot = join(root, 'src');
const textExtensions = new Set(['.ts', '.tsx', '.json']);
const forbidden = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/[\w.+-]+@(?!example\.(?:com|org|test))[\w.-]+\.[A-Za-z]{2,}/, 'non-example email'],
  [/(?:\+91[ -]?)?[6-9]\d{9}\b/, 'realistic Indian phone number'],
];

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const violations = [];
for (const path of files(sourceRoot).filter((file) => textExtensions.has(extname(file)))) {
  const content = readFileSync(path, 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(content)) violations.push(`${relative(root, path)}: possible ${label}`);
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Source fixtures contain no detected secrets or realistic contact details.');
