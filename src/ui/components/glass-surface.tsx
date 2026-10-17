import { BlurView } from 'expo-blur';
import type { ReactNode, RefObject } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GLASS_RADIUS, GLASS_UI, colors, glass, radii } from '@/ui/theme/tokens';

/** Android 12; below it `blurTarget` cannot blur, so the panel takes the dense no-blur frost. */
const ANDROID_BLUR_API = 31;

/**
 * Frosted "liquid glass" panel: native blur, a milky tint, a specular top edge and a hairline
 * rim. On Android a real blur needs a `blurTarget` that is not an ancestor of the panel, so
 * in-flow panels fall back to the translucent tint there while floating chrome stays blurred.
 * With `GLASS_UI` off it renders a flat card instead.
 */
export function GlassSurface({
  children,
  style,
  radius = GLASS_RADIUS,
  tint,
  blurTarget,
  onLayout,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Overrides the white tint layer, e.g. a warm wash for warnings. */
  tint?: string;
  blurTarget?: RefObject<View | null>;
  onLayout?: (height: number) => void;
}) {
  const handleLayout =
    onLayout && ((event: LayoutChangeEvent) => onLayout(event.nativeEvent.layout.height));
  if (!GLASS_UI) {
    return (
      <View
        onLayout={handleLayout}
        style={[styles.flat, tint ? { backgroundColor: tint } : null, style]}
      >
        {children}
      </View>
    );
  }
  const androidBlur =
    Platform.OS === 'android' && Platform.Version >= ANDROID_BLUR_API && blurTarget;
  return (
    <View onLayout={handleLayout} style={[styles.glass, { borderRadius: radius }, style]}>
      <BlurView
        blurMethod={androidBlur ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurTarget={androidBlur ? blurTarget : undefined}
        intensity={Platform.OS === 'ios' ? 60 : 40}
        style={StyleSheet.absoluteFill}
        tint="systemUltraThinMaterialLight"
      />
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          !androidBlur && Platform.OS === 'android' && styles.tintSolid,
          tint ? { backgroundColor: tint } : null,
        ]}
      />
      <View pointerEvents="none" style={styles.sheen} />
      <View pointerEvents="none" style={[styles.highlight, { left: radius, right: radius }]} />
      {children}
    </View>
  );
}

/**
 * Curved specular rim along the top edge of a small glass bubble. A rim rather than a filled
 * band, so solid-coloured bubbles keep one even tone. `radius` should match the parent's.
 */
export function GlassSheen({ radius = 999 }: { radius?: number }) {
  if (!GLASS_UI) return null;
  return <View pointerEvents="none" style={[styles.bubbleSheen, { borderRadius: radius }]} />;
}

/** Soft colour fields that give the glass something to refract. Place behind content. */
export function GlassBackdrop() {
  if (!GLASS_UI) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glow, styles.glowTopStart]} />
      <View style={[styles.glow, styles.glowTopEnd]} />
      <View style={[styles.glow, styles.glowMiddle]} />
      <View style={[styles.glow, styles.glowBottomStart]} />
      <View style={[styles.glow, styles.glowBottomEnd]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flat: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  glass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.panelRim,
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: glass.frost },
  tintSolid: { backgroundColor: glass.frostSolid },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: glass.panelSheen,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    height: 1,
    backgroundColor: glass.panelHighlight,
  },
  bubbleSheen: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: 1,
    borderColor: glass.sheen,
  },
  glow: { position: 'absolute', borderRadius: 999 },
  glowTopStart: {
    top: -60,
    left: -50,
    width: 240,
    height: 240,
    backgroundColor: glass.backdrop.topStart,
  },
  glowTopEnd: {
    top: 20,
    right: -70,
    width: 210,
    height: 210,
    backgroundColor: glass.backdrop.topEnd,
  },
  glowMiddle: {
    top: '38%',
    left: -90,
    width: 260,
    height: 260,
    backgroundColor: glass.backdrop.middle,
  },
  glowBottomStart: {
    bottom: 80,
    right: -80,
    width: 280,
    height: 280,
    backgroundColor: glass.backdrop.bottomStart,
  },
  glowBottomEnd: {
    bottom: -90,
    left: 20,
    width: 240,
    height: 240,
    backgroundColor: glass.backdrop.bottomEnd,
  },
});
