import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

type Environment = 'development' | 'preview' | 'production';

function environmentFromProcess(): Environment {
  const value = process.env.GYMVITO_ENV ?? 'development';
  if (value === 'development' || value === 'preview' || value === 'production') return value;
  throw new Error(`Unsupported GYMVITO_ENV: ${value}`);
}

export default function configure({ config }: ConfigContext): ExpoConfig {
  const base = appJson.expo as ExpoConfig;
  const environment = environmentFromProcess();
  const suffix = environment === 'production' ? '' : `.${environment}`;
  const releaseExtra = Object.fromEntries(
    Object.entries(base.extra ?? {}).filter(([key]) => key !== 'developmentRuntime'),
  );
  return {
    ...config,
    ...base,
    name: environment === 'production' ? 'GymVito' : `GymVito ${environment}`,
    android: { ...base.android, package: `com.gymvito.app${suffix}` },
    ios: { ...base.ios, bundleIdentifier: `com.gymvito.app${suffix}` },
    extra: {
      ...(environment === 'development' ? base.extra : releaseExtra),
      environment,
      runtimeBackend: 'none',
    },
  };
}
