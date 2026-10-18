import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppLanguage, MIN_PIN_LENGTH, MAX_PIN_LENGTH } from '@/domain/onboarding/onboarding';
import {
  MAX_FAILED_ATTEMPTS_BEFORE_DELAY,
  lockoutSecondsFor,
} from '@/domain/security/lockout-policy';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton } from '@/ui/components/core-controls';
import { GlassBlurTarget, GlassProvider, useGlassBlurTarget } from '@/ui/components/glass-context';
import { GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import {
  actionPressed,
  CARD_RADIUS,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

const KEYPAD_ROWS = [
  [
    ['1', ''],
    ['2', 'ABC'],
    ['3', 'DEF'],
  ],
  [
    ['4', 'GHI'],
    ['5', 'JKL'],
    ['6', 'MNO'],
  ],
  [
    ['7', 'PQRS'],
    ['8', 'TUV'],
    ['9', 'WXYZ'],
  ],
] as const;

export default function UnlockRoute() {
  const { state, unlockWithPin, unlockWithBiometrics, changeLanguage } = useAppSession();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(64);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const settings = state.status === 'locked' ? state.snapshot.settings : undefined;
  const biometricsEnabled = Boolean(settings?.biometricsEnabled);

  // Offer biometrics as soon as the screen is in the foreground, once per visit. A cancel
  // falls back to the keypad quietly; the Scan key stays available to retry.
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (!biometricsEnabled) return;
    const prompt = () => {
      if (autoPrompted.current) return;
      autoPrompted.current = true;
      void unlockWithBiometrics().catch(() => undefined);
    };
    // iOS can report 'unknown' at cold start, before the first change event.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') {
      prompt();
      return;
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') prompt();
    });
    return () => subscription.remove();
  }, [biometricsEnabled, unlockWithBiometrics]);

  if (state.status !== 'locked') return <Redirect href="/" />;
  const language = settings?.language ?? 'en';
  const lockedOut = remaining > 0;
  const keypadDisabled = busy || lockedOut;
  const slotCount = Math.max(MIN_PIN_LENGTH, pin.length);

  const pressDigit = (digit: string) => {
    if (keypadDisabled) return;
    setMessage(null);
    setPin((value) => (value.length >= MAX_PIN_LENGTH ? value : value + digit));
  };

  const deleteDigit = () => {
    if (keypadDisabled) return;
    setPin((value) => value.slice(0, -1));
  };

  const submitPin = async () => {
    if (lockedOut || pin.length < MIN_PIN_LENGTH) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await unlockWithPin(pin);
      if (result.status === 'invalid-pin') setMessage(t('pinIncorrect'));
      if (result.status === 'locked-out') {
        setRemaining(result.remainingSeconds);
        setMessage(null);
      }
      if (result.status !== 'success') setPin('');
    } catch {
      setMessage(t('unlockFailed'));
    } finally {
      setBusy(false);
    }
  };

  const biometricUnlock = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await unlockWithBiometrics();
    if (result !== 'success') setMessage(t('biometricFallback'));
    setBusy(false);
  };

  return (
    <GlassProvider>
      <View style={styles.screen}>
        <GlassBlurTarget style={styles.blurTarget}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + GLASS_INSET + headerHeight + spacing.md,
                paddingLeft: spacing.md + insets.left,
                paddingRight: spacing.md + insets.right,
                paddingBottom: spacing.lg + insets.bottom,
              },
            ]}
          >
            <GlassSurface radius={CARD_RADIUS} style={styles.prompt}>
              <View style={styles.promptIcon}>
                <MaterialSymbol color={colors.primaryDark} name="pin" size={26} />
              </View>
              <Text accessibilityRole="header" style={styles.promptTitle}>
                {t('unlockEnterPin')}
              </Text>
              <Text style={styles.promptSubtitle}>{t('unlockPinHint')}</Text>
              <View
                accessibilityLabel={t('unlockPinProgress', { count: pin.length })}
                accessibilityLiveRegion="polite"
                style={styles.slots}
              >
                {Array.from({ length: slotCount }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.slot, index < pin.length && styles.slotFilled]}
                  />
                ))}
              </View>
              {lockedOut ? (
                <View style={[styles.statusPill, styles.statusPillDanger]}>
                  <MaterialSymbol color={colors.danger} name="timer" size={15} />
                  <Text style={[styles.statusPillText, styles.statusPillTextDanger]}>
                    {t('pinLocked', { count: remaining })}
                  </Text>
                </View>
              ) : message ? (
                <View style={[styles.statusPill, styles.statusPillDanger]}>
                  <MaterialSymbol color={colors.danger} name="error" size={15} />
                  <Text
                    accessibilityRole="alert"
                    style={[styles.statusPillText, styles.statusPillTextDanger]}
                  >
                    {message}
                  </Text>
                </View>
              ) : (
                <View style={styles.statusPill}>
                  <MaterialSymbol color={colors.primaryDark} name="shield" size={15} />
                  <Text style={styles.statusPillText}>
                    {t('unlockAttemptsNotice', {
                      count: MAX_FAILED_ATTEMPTS_BEFORE_DELAY,
                      seconds: lockoutSecondsFor(MAX_FAILED_ATTEMPTS_BEFORE_DELAY),
                    })}
                  </Text>
                </View>
              )}
            </GlassSurface>

            <GlassSurface radius={CARD_RADIUS} style={styles.keypad}>
              <View accessibilityLabel={t('unlockKeypad')} style={styles.keypadGrid}>
                {KEYPAD_ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.keypadRow}>
                    {row.map(([digit, letters]) => (
                      <DigitKey
                        disabled={keypadDisabled}
                        digit={digit}
                        key={digit}
                        letters={letters}
                        onPress={pressDigit}
                      />
                    ))}
                  </View>
                ))}
                <View style={styles.keypadRow}>
                  {biometricsEnabled ? (
                    <Pressable
                      accessibilityLabel={t('useBiometrics')}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void biometricUnlock()}
                      style={({ pressed }) => [
                        styles.key,
                        styles.keySecondary,
                        pressed && styles.keyPressed,
                      ]}
                    >
                      {({ pressed }) => (
                        <>
                          <View style={styles.keyIcons}>
                            <MaterialSymbol
                              color={pressed ? colors.onPrimary : colors.primaryDark}
                              name="fingerprint"
                              size={20}
                            />
                            <MaterialSymbol
                              color={pressed ? colors.onPrimary : colors.primaryDark}
                              name="face"
                              size={20}
                            />
                          </View>
                          <Text style={[styles.keyAction, pressed && styles.keyTextPressed]}>
                            {t('unlockScan')}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.keySpacer} />
                  )}
                  <DigitKey disabled={keypadDisabled} digit="0" letters="" onPress={pressDigit} />
                  <Pressable
                    accessibilityHint={t('unlockClearHint')}
                    accessibilityLabel={t('unlockDeleteDigit')}
                    accessibilityRole="button"
                    disabled={keypadDisabled || pin.length === 0}
                    onLongPress={() => setPin('')}
                    onPress={deleteDigit}
                    style={({ pressed }) => [
                      styles.key,
                      styles.keySecondary,
                      pressed && styles.keyDeletePressed,
                    ]}
                  >
                    <MaterialSymbol color={colors.text} name="backspace" size={22} />
                    <Text style={styles.keyAction}>{t('unlockClear')}</Text>
                  </Pressable>
                </View>
              </View>

              <AppButton
                disabled={busy || lockedOut || pin.length < MIN_PIN_LENGTH}
                onPress={() => void submitPin()}
                style={styles.unlockButton}
              >
                {busy ? t('unlocking') : t('unlock')}
              </AppButton>
            </GlassSurface>

            <GlassSurface radius={CARD_RADIUS} style={styles.notice}>
              <View style={styles.noticeRow}>
                <MaterialSymbol color={colors.primaryDark} name="info" size={18} />
                <Text style={styles.noticeText}>{t('unlockDeviceOnlyNotice')}</Text>
              </View>
              <Text style={styles.footerNote}>{t('unlockOfflineFooter')}</Text>
            </GlassSurface>
          </ScrollView>
        </GlassBlurTarget>

        <UnlockHeader
          insets={insets}
          language={language}
          onChangeLanguage={(next) => void changeLanguage(next)}
          onLayout={setHeaderHeight}
        />
      </View>
    </GlassProvider>
  );
}

/** Floating header; a sibling of the blur target so Android 12+ can blur the page under it. */
function UnlockHeader({
  insets,
  language,
  onChangeLanguage,
  onLayout,
}: {
  insets: EdgeInsets;
  language: AppLanguage;
  onChangeLanguage(language: AppLanguage): void;
  onLayout(height: number): void;
}) {
  const { t } = useTranslation();
  const blurTargetRef = useGlassBlurTarget();
  return (
    <GlassSurface
      blurTarget={blurTargetRef}
      onLayout={onLayout}
      style={[
        styles.glassHeader,
        {
          top: insets.top + GLASS_INSET,
          left: GLASS_INSET + insets.left,
          right: GLASS_INSET + insets.right,
        },
      ]}
    >
      <View style={styles.headerIdentity}>
        <View style={styles.brandMark}>
          <MaterialSymbol color={colors.onPrimary} name="fitness_center" size={20} />
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.brandName}>GymVito</Text>
          <View style={styles.headerStatus}>
            <View style={styles.statusDot} />
            <Text numberOfLines={1} style={styles.headerStatusText}>
              {t('unlockVaultStatus')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.lockBadge}>
          <MaterialSymbol color={colors.primaryDark} name="lock" size={14} />
          <Text style={styles.lockBadgeText}>{t('unlockLockedBadge')}</Text>
        </View>
        <Pressable
          accessibilityLabel={t('languageLabel')}
          accessibilityRole="button"
          onPress={() => onChangeLanguage(language === 'en' ? 'hi' : 'en')}
          style={({ pressed }) => [styles.languageToggle, pressed && actionPressed]}
        >
          <Text numberOfLines={1} style={styles.languageText}>
            {language === 'en' ? 'EN | हिं' : 'हिं | EN'}
          </Text>
        </Pressable>
      </View>
    </GlassSurface>
  );
}

function DigitKey({
  digit,
  letters,
  disabled,
  onPress,
}: {
  digit: string;
  letters: string;
  disabled: boolean;
  onPress: (digit: string) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={digit}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(digit)}
      style={({ pressed }) => [
        styles.key,
        styles.keyDigit,
        pressed && styles.keyPressed,
        disabled && styles.keyDisabled,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text style={[styles.keyDigitText, pressed && styles.keyTextPressed]}>{digit}</Text>
          <Text style={[styles.keyLetters, pressed && styles.keyTextPressed]}>
            {letters || ' '}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const KEY_SIZE = 68;
const GLASS_INSET = 12;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  blurTarget: { flex: 1, backgroundColor: colors.background },
  glassHeader: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    shadowOpacity: 0.12,
    elevation: 6,
  },
  headerIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: glass.rimSoft,
    backgroundColor: colors.primary,
  },
  headerTitles: { minWidth: 0, flex: 1 },
  brandName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  headerStatusText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  headerActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillNeutral,
  },
  lockBadgeText: {
    color: colors.primaryDark,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  languageToggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  languageText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 12,
  },
  prompt: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md + 4,
    paddingHorizontal: spacing.md,
  },
  promptIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  promptTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  promptSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: spacing.md,
    minHeight: 24,
    alignItems: 'center',
  },
  slot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: glass.rimPrimary,
    backgroundColor: glass.fillMuted,
  },
  slotFilled: {
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: glass.fillMint,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  statusPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimSuccess,
    backgroundColor: glass.fillSuccess,
  },
  statusPillDanger: {
    borderColor: glass.rimDanger,
    backgroundColor: glass.fillDanger,
  },
  statusPillText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  statusPillTextDanger: { color: colors.dangerText },
  keypad: {
    gap: spacing.md,
    paddingTop: spacing.md + 4,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  keypadGrid: { gap: spacing.sm + 2, paddingHorizontal: spacing.xs },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: KEY_SIZE / 2,
    borderWidth: 1,
    borderColor: glass.rimAccent,
  },
  keySpacer: { width: KEY_SIZE, height: KEY_SIZE },
  keyDigit: {
    backgroundColor: glass.fillOpaque,
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  keySecondary: { backgroundColor: glass.fillAccent },
  keyPressed: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
    transform: actionPressed.transform,
  },
  keyDeletePressed: {
    borderColor: glass.rimDanger,
    backgroundColor: glass.fillDanger,
    transform: actionPressed.transform,
  },
  keyDisabled: { opacity: 0.5 },
  keyDigitText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 24, lineHeight: 28 },
  keyLetters: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
  keyAction: {
    marginTop: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  keyIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  keyTextPressed: { color: colors.onPrimary },
  unlockButton: {
    minHeight: 52,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  notice: { gap: 12, padding: spacing.md, shadowOpacity: 0.06 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  footerNote: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
