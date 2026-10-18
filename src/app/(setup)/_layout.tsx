import { Redirect, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useAppSession } from '@/features/session/app-session-context';
import { GlassBlurTarget, GlassProvider } from '@/ui/components/glass-context';
import { colors } from '@/ui/theme/tokens';

export default function SetupLayout() {
  const { state } = useAppSession();
  if (state.status !== 'setup-required') return <Redirect href="/" />;
  return (
    <GlassProvider>
      <GlassBlurTarget style={styles.root}>
        <Stack screenOptions={{ contentStyle: styles.transparent, headerShown: false }} />
      </GlassBlurTarget>
    </GlassProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  transparent: { backgroundColor: 'transparent' },
});
