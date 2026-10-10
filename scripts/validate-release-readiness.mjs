import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const configSource = readFileSync(resolve(root, 'app.config.ts'), 'utf8');

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

requireCondition(app.version === pkg.version, 'app.json and package.json versions must match.');
requireCondition(/^\d+\.\d+\.\d+$/.test(app.version), 'Release version must use semver.');
requireCondition(app.android?.package === 'com.gymvito.app', 'Production Android package changed.');
requireCondition(app.android?.allowBackup === false, 'Android system backup must stay disabled.');
requireCondition(
  app.android?.blockedPermissions?.includes('android.permission.READ_EXTERNAL_STORAGE') &&
    app.android?.blockedPermissions?.includes('android.permission.WRITE_EXTERNAL_STORAGE'),
  'Broad Android storage permissions must remain blocked.',
);
requireCondition(
  eas.build?.production?.distribution === 'store',
  'Production must be a store build.',
);
requireCondition(
  eas.build?.production?.android?.buildType === 'app-bundle',
  'Production Android output must be an app bundle.',
);
requireCondition(
  eas.build?.production?.env?.GYMVITO_ENV === 'production',
  'Production profile must select the production environment.',
);
requireCondition(
  configSource.includes("key !== 'developmentRuntime'"),
  'Production config must remove the Expo Go development marker.',
);

for (const asset of [
  app.icon,
  app.android?.adaptiveIcon?.foregroundImage,
  app.android?.adaptiveIcon?.monochromeImage,
]) {
  requireCondition(
    typeof asset === 'string' && existsSync(resolve(root, asset)),
    `Missing asset: ${asset}`,
  );
}

console.log(`Release configuration valid for GymVito ${app.version}.`);
