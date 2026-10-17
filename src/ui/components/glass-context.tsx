import { BlurTargetView } from 'expo-blur';
import { createContext, type ReactNode, type RefObject, useContext, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { GlassBackdrop } from '@/ui/components/glass-surface';
import { GLASS_UI } from '@/ui/theme/tokens';

const GlassContext = createContext<RefObject<View | null> | undefined>(undefined);

/**
 * Owns the blur target for one navigator. Wrap both the `GlassBlurTarget` and the floating
 * chrome that blurs over it; on Android a blur target must not be an ancestor of the blur.
 */
export function GlassProvider({ children }: { children: ReactNode }) {
  const blurTargetRef = useRef<View | null>(null);
  return <GlassContext.Provider value={blurTargetRef}>{children}</GlassContext.Provider>;
}

/** Ref for `GlassSurface`'s `blurTarget`; `undefined` outside a `GlassProvider`. */
export function useGlassBlurTarget(): RefObject<View | null> | undefined {
  return useContext(GlassContext);
}

/** The backdrop and the content that floating chrome blurs over. */
export function GlassBlurTarget({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const blurTargetRef = useGlassBlurTarget();
  if (!GLASS_UI || !blurTargetRef) return <View style={style}>{children}</View>;
  return (
    <BlurTargetView ref={blurTargetRef} style={style}>
      <GlassBackdrop />
      {children}
    </BlurTargetView>
  );
}
