import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const preview = config.build?.preview;
const development = config.build?.development;

if (config.cli?.appVersionSource !== 'remote') {
  throw new Error('EAS must manage version codes remotely for repeatable APK updates.');
}
if (
  preview?.distribution !== 'internal' ||
  preview?.android?.buildType !== 'apk' ||
  preview?.env?.GYMVITO_ENV !== 'preview' ||
  preview?.autoIncrement !== true
) {
  throw new Error('The standalone preview APK profile is incomplete.');
}
if (
  development?.developmentClient !== true ||
  development?.distribution !== 'internal' ||
  development?.android?.buildType !== 'apk' ||
  development?.env?.GYMVITO_ENV !== 'development'
) {
  throw new Error('The Android development-client profile is incomplete.');
}

console.log('Validated development-client and standalone preview APK profiles.');
