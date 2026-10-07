import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  ...expoConfig,
  { ignores: ['android/**', 'ios/**', 'coverage/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Direct networking is outside the GymVito runtime boundary.' },
        {
          name: 'XMLHttpRequest',
          message: 'Direct networking is outside the GymVito runtime boundary.',
        },
        {
          name: 'WebSocket',
          message: 'Direct networking is outside the GymVito runtime boundary.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['axios', '@apollo/*', '@tanstack/react-query', 'firebase*', '@supabase/*'],
              message: 'Network and remote-data clients require a reviewed architecture decision.',
            },
          ],
        },
      ],
    },
  },
]);
