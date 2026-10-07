import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';

import { AppSessionProvider, useAppSession } from '@/features/session/app-session-context';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    MaterialSymbols_400Regular,
    NotoSansDevanagari_400Regular,
  });
  ScreenCapture.usePreventScreenCapture('gymvito-sensitive-routes');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void ScreenCapture.enableAppSwitcherProtectionAsync(0.8);
    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppSessionProvider>
        <ActivityBoundary />
      </AppSessionProvider>
    </SafeAreaProvider>
  );
}

function ActivityBoundary() {
  const { recordActivity } = useAppSession();
  return (
    <View onTouchStart={recordActivity} style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
