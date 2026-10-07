import { readFileSync } from 'node:fs';

const locales = ['en', 'hi'];
const dictionaries = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
    ),
  ]),
);
const baseKeys = Object.keys(dictionaries.en).sort();
const placeholderPattern = /{{\s*([^},\s]+)[^}]*}}/g;

for (const locale of locales) {
  const keys = Object.keys(dictionaries[locale]).sort();
  if (JSON.stringify(keys) !== JSON.stringify(baseKeys)) {
    throw new Error(`${locale} translation keys do not match English.`);
  }
  for (const key of baseKeys) {
    if (!dictionaries[locale][key].trim()) throw new Error(`${locale}.${key} is blank.`);
    const basePlaceholders = [...dictionaries.en[key].matchAll(placeholderPattern)]
      .map((match) => match[1])
      .sort();
    const localePlaceholders = [...dictionaries[locale][key].matchAll(placeholderPattern)]
      .map((match) => match[1])
      .sort();
    if (JSON.stringify(basePlaceholders) !== JSON.stringify(localePlaceholders)) {
      throw new Error(`${locale}.${key} placeholders do not match English.`);
    }
  }
}
console.log(`Validated ${baseKeys.length} keys across ${locales.length} locales.`);
