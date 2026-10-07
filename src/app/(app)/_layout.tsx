import { Redirect, Stack } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSession } from '@/features/session/app-session-context';
import {
  BUSINESS_NAV_PHONE_HEIGHT,
  BUSINESS_NAV_TABLET_WIDTH,
  BusinessNavigation,
} from '@/ui/components/operational-shell';

export default function BusinessLayout() {
  const { state } = useAppSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (state.status !== 'unlocked') return <Redirect href="/" />;
  const tablet = width >= 600;

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

const styles = StyleSheet.create({
  root: { flex: 1 },
  routes: { flex: 1 },
});
