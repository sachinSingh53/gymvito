import { Redirect, Stack } from 'expo-router';

import { useAppSession } from '@/features/session/app-session-context';

export default function SetupLayout() {
  const { state } = useAppSession();
  if (state.status !== 'setup-required') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
