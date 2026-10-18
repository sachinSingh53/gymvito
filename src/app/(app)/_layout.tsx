import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppSession } from '@/features/session/app-session-context';
import { GlassBlurTarget, GlassProvider } from '@/ui/components/glass-context';
import {
  BusinessChromeProvider,
  BusinessNavigation,
  FloatingHeaderHost,
  useBusinessNavigationInset,
} from '@/ui/components/operational-shell';
import { colors } from '@/ui/theme/tokens';

export default function BusinessLayout() {
  const { state } = useAppSession();
  if (state.status !== 'unlocked') return <Redirect href="/" />;
  return (
    <GlassProvider>
      <BusinessChromeProvider>
        <GlassBusinessRoutes />
      </BusinessChromeProvider>
    </GlassProvider>
  );
}

/**
 * Routes scroll under the floating navigation, which blurs them along with the backdrop. The
 * header host comes first so screen readers still reach the header before the content.
 */
function GlassBusinessRoutes() {
  const navigationInset = useBusinessNavigationInset();
  return (
    <View style={styles.root}>
      <FloatingHeaderHost style={styles.chrome} />
      <GlassBlurTarget style={styles.glassRoot}>
        <View style={[styles.routes, { paddingLeft: navigationInset.left }]}>
          <Stack
            screenOptions={{
              animation: 'none',
              contentStyle: styles.transparent,
              headerShown: false,
            }}
          />
        </View>
      </GlassBlurTarget>
      <BusinessNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  routes: { flex: 1 },
  glassRoot: { flex: 1, backgroundColor: colors.background },
  chrome: { zIndex: 10 },
  transparent: { backgroundColor: 'transparent' },
});
