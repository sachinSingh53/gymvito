import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricResult = 'success' | 'fallback-to-pin';

export async function canUseBiometrics(): Promise<boolean> {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

export async function authenticateWithBiometrics(
  promptMessage: string,
  cancelLabel: string,
): Promise<BiometricResult> {
  if (!(await canUseBiometrics())) return 'fallback-to-pin';

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel,
    disableDeviceFallback: true,
  });
  return result.success ? 'success' : 'fallback-to-pin';
}
