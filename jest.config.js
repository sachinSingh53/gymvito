module.exports = {
  preset: 'jest-expo',
  watchman: false,
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/testing/setup-tests.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  collectCoverageFrom: [
    'src/domain/**/*.{ts,tsx}',
    'src/data/database/migrations/**/*.{ts,tsx}',
    'src/platform/backup/backup-manifest.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
