import Constants, { AppOwnership } from 'expo-constants';

export type DatabaseSecurityMode = 'expo-go-plaintext' | 'sqlcipher';

export type RuntimeCapabilities = Readonly<{
  isExpoGo: boolean;
  databaseSecurityMode: DatabaseSecurityMode;
  nativeSecurityProofs: boolean;
}>;

export function runtimeCapabilitiesFor(
  appOwnership: string | null | undefined,
): RuntimeCapabilities {
  const isExpoGo = appOwnership === AppOwnership.Expo;
  return {
    isExpoGo,
    databaseSecurityMode: isExpoGo ? 'expo-go-plaintext' : 'sqlcipher',
    nativeSecurityProofs: !isExpoGo,
  };
}

export function getRuntimeCapabilities(): RuntimeCapabilities {
  return runtimeCapabilitiesFor(Constants.appOwnership);
}
