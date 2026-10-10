import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const project = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD']);
const reviewedComposite = new Set(['MIT AND Apache-2.0', 'MIT AND OFL-1.1']);
const dependencies = Object.keys({ ...project.dependencies, ...project.devDependencies }).sort();
const findings = [];

for (const name of dependencies) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8'),
  );
  const license = manifest.license ?? 'UNDECLARED';
  if (!allowed.has(license) && !reviewedComposite.has(license)) {
    findings.push(`${name}@${manifest.version}: ${license}`);
  }
}

if (findings.length) {
  throw new Error(`Unreviewed direct dependency license(s):\n${findings.join('\n')}`);
}

const forbiddenRuntimePackages = ['@sentry/react-native', 'firebase', 'posthog-react-native'];
for (const name of forbiddenRuntimePackages) {
  if (project.dependencies?.[name])
    throw new Error(`Unapproved telemetry/network dependency: ${name}`);
}

console.log(
  `Reviewed ${dependencies.length} direct dependency licenses; no unapproved license found.`,
);
