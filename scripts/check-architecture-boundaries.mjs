import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const sourceRoot = join(root, 'src');

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const violations = [];
for (const path of files(sourceRoot).filter((file) => ['.ts', '.tsx'].includes(extname(file)))) {
  const content = readFileSync(path, 'utf8');
  const relativePath = relative(root, path);
  if (
    relativePath.startsWith('src/domain/') &&
    /from ['"](?:react|react-native|expo(?:-|\/|['"]))/m.test(content)
  ) {
    violations.push(`${relativePath}: domain code imports a framework or device API`);
  }
  if (
    /from ['"]expo-sqlite['"]/.test(content) &&
    !relativePath.startsWith('src/data/') &&
    !relativePath.startsWith('src/platform/backup/') &&
    !relativePath.startsWith('src/testing/')
  ) {
    violations.push(`${relativePath}: SQLite access is outside data/backup/test boundaries`);
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Architecture dependency boundaries valid.');
