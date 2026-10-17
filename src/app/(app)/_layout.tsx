import { Redirect, Stack } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSession } from '@/features/session/app-session-context';
import { GlassBlurTarget, GlassProvider } from '@/ui/components/glass-context';
import {
  BUSINESS_NAV_PHONE_HEIGHT,
  BUSINESS_NAV_TABLET_WIDTH,
  BusinessChromeProvider,
  BusinessNavigation,
  FloatingHeaderHost,
  useBusinessNavigationInset,
} from '@/ui/components/operational-shell';
import { GLASS_UI, colors } from '@/ui/theme/tokens';

export default function BusinessLayout() {
  const { state } = useAppSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (state.status !== 'unlocked') return <Redirect href="/" />;
  const tablet = width >= 600;

  if (GLASS_UI) {
    return (
      <GlassProvider>
        <BusinessChromeProvider>
          <GlassBusinessRoutes />
        </BusinessChromeProvider>
      </GlassProvider>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.routes,
          tablet
            ? { paddingLeft: BUSINESS_NAV_TABLET_WIDTH + insets.left }
            : { paddingBottom: BUSINESS_NAV_PHONE_HEIGHT + insets.bottom },
        ]}
      >
        <Stack screenOptions={{ animation: 'none', headerShown: false }} />
      </View>
      <BusinessNavigation />
    </View>
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
