import { Redirect, Stack } from 'expo-router';

import { useAppSession } from '@/features/session/app-session-context';

export default function BusinessLayout() {
  const { state } = useAppSession();
  if (state.status !== 'unlocked') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
