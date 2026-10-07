import { AppOwnership } from 'expo-constants';

import { runtimeCapabilitiesFor } from './runtime-capabilities';

describe('runtime capabilities', () => {
  it('uses a safe compatibility mode in Expo Go', () => {
    expect(runtimeCapabilitiesFor(AppOwnership.Expo)).toEqual({
      isExpoGo: true,
      databaseSecurityMode: 'expo-go-plaintext',
      nativeSecurityProofs: false,
    });
  });

  it.each([null, undefined])('keeps native security features outside Expo Go', (ownership) => {
    expect(runtimeCapabilitiesFor(ownership)).toEqual({
      isExpoGo: false,
      databaseSecurityMode: 'sqlcipher',
      nativeSecurityProofs: true,
    });
  });
});
