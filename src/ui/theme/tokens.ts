import type { ViewStyle } from 'react-native';

/** Build-time kill switch for the liquid glass design. `false` renders the flat surfaces. */
export const GLASS_UI = true;

export const colors = Object.freeze({
  background: '#e5fff8',
  canvas: '#f4fbf8',
  surface: '#ffffff',
  surfaceLow: '#dff9f3',
  surfaceContainer: '#d9f3ed',
  surfaceHigh: '#d4eee7',
  surfaceHighest: '#cee8e1',
  surfaceMuted: '#dcece7',
  brandHeader: '#071a18',
  primary: '#0d6659',
  primaryDark: '#004c42',
  primaryPressed: '#084b42',
  onPrimary: '#ffffff',
  text: '#162d29',
  textMuted: '#526963',
  onDark: '#f4fbf8',
  danger: '#a92e2e',
  dangerSurface: '#fde8e8',
  dangerText: '#6a1616',
  successSurface: '#e6f5f0',
  successText: '#0d4732',
  warningSurface: '#fff4d6',
  warningText: '#7c5300',
  warningBorder: '#f1d38a',
  warningAccent: '#615a43',
  warningStrongText: '#201b09',
  border: '#dcece7',
  outline: '#6f7976',
  focus: '#2f8f80',
});

export const spacing = Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 });
export const radii = Object.freeze({ sm: 8, md: 14, lg: 16, pill: 999 });

/** Floating chrome (header, navigation, sticky footers). */
export const GLASS_RADIUS = 28;
/** Content panels. */
export const CARD_RADIUS = 24;

/** Translucent fills and rims for glass surfaces and the controls that sit on them. */
export const glass = Object.freeze({
  rim: 'rgba(255, 255, 255, 0.85)',
  rimSoft: 'rgba(255, 255, 255, 0.4)',
  fill: 'rgba(255, 255, 255, 0.6)',
  fillMint: 'rgba(217, 243, 237, 0.65)',
  fillPrimary: 'rgba(13, 102, 89, 0.92)',
  /** Light, brand-tinted fill for secondary buttons sitting on white glass. */
  fillAccent: 'rgba(13, 102, 89, 0.08)',
  rimAccent: 'rgba(13, 102, 89, 0.2)',
  rimPrimary: 'rgba(13, 102, 89, 0.35)',
  fillDanger: 'rgba(253, 232, 232, 0.8)',
  fillDangerStrong: 'rgba(169, 46, 46, 0.9)',
  rimDanger: 'rgba(245, 190, 190, 0.8)',
  rimDangerStrong: 'rgba(245, 190, 190, 0.9)',
  fillWarning: 'rgba(255, 244, 214, 0.8)',
  fillWarningStrong: 'rgba(97, 90, 67, 0.9)',
  rimWarning: 'rgba(241, 211, 138, 0.8)',
  /** Near-opaque white for controls and fields that must stand out from white glass. */
  fillOpaque: 'rgba(255, 255, 255, 0.9)',
  fillMuted: 'rgba(206, 232, 225, 0.7)',
  fillOnPrimary: 'rgba(255, 255, 255, 0.18)',
  divider: 'rgba(13, 102, 89, 0.12)',
  sheen: 'rgba(255, 255, 255, 0.45)',
  /** Panel tints; keep at ≥ 0.85 alpha so text stays legible over the backdrop. */
  tintSuccess: 'rgba(230, 245, 240, 0.88)',
  tintWarning: 'rgba(250, 242, 220, 0.92)',
  /** Frost layer of a panel. Do not lower: in-flow panels on Android get no real blur. */
  frost: 'rgba(255, 255, 255, 0.62)',
  frostSolid: 'rgba(255, 255, 255, 0.86)',
  panelRim: 'rgba(255, 255, 255, 0.75)',
  panelSheen: 'rgba(255, 255, 255, 0.12)',
  panelHighlight: 'rgba(255, 255, 255, 0.95)',
  backdrop: Object.freeze({
    topStart: 'rgba(137, 213, 196, 0.6)',
    topEnd: 'rgba(165, 241, 224, 0.75)',
    middle: 'rgba(149, 225, 208, 0.45)',
    bottomStart: 'rgba(137, 213, 196, 0.5)',
    bottomEnd: 'rgba(237, 226, 197, 0.55)',
  }),
});

/** Shared pressed feedback for tappable surfaces and controls. */
export const actionPressed: ViewStyle = Object.freeze({
  opacity: 0.72,
  transform: [{ scale: 0.98 }],
});

export const fonts = Object.freeze({
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  devanagari: 'NotoSansDevanagari_400Regular',
  symbols: 'MaterialSymbols_400Regular',
});
