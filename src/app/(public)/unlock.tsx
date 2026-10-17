import { Redirect } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_PIN_LENGTH, MAX_PIN_LENGTH } from '@/domain/onboarding/onboarding';
import {
  MAX_FAILED_ATTEMPTS_BEFORE_DELAY,
  lockoutSecondsFor,
} from '@/domain/security/lockout-policy';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton } from '@/ui/components/core-controls';
import { GlassBackdrop, GlassSheen, GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

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
  const blurTargetRef = useRef<View | null>(null);
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

  if (state.status !== 'locked') return <Redirect href="/" />;
  const settings = state.snapshot.settings;
  const language = settings?.language ?? 'en';
  const biometricsEnabled = Boolean(settings?.biometricsEnabled);
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
    <View style={styles.screen}>
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <GlassBackdrop />
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
          <GlassSurface style={styles.prompt}>
            <View style={styles.promptIcon}>
              <GlassSheen />
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
                <View key={index} style={[styles.slot, index < pin.length && styles.slotFilled]} />
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

          <GlassSurface style={styles.keypad}>
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
                        <GlassSheen />
                        <View style={styles.keyIcons}>
                          <MaterialSymbol
                            color={pressed ? '#fff' : colors.primaryDark}
                            name="fingerprint"
                            size={20}
                          />
                          <MaterialSymbol
                            color={pressed ? '#fff' : colors.primaryDark}
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
                  <GlassSheen />
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

          <GlassSurface radius={radii.lg + 4} style={styles.notice}>
            <MaterialSymbol color={colors.primaryDark} name="info" size={18} />
            <Text style={styles.noticeText}>{t('unlockDeviceOnlyNotice')}</Text>
          </GlassSurface>

          <Text style={styles.footerNote}>{t('unlockOfflineFooter')}</Text>
        </ScrollView>
      </BlurTargetView>

      <GlassSurface
        blurTarget={blurTargetRef}
        onLayout={(height) => setHeaderHeight(height)}
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
            <View pointerEvents="none" style={styles.brandMarkHighlight} />
            <MaterialSymbol color="#fff" name="fitness_center" size={20} />
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
            onPress={() => void changeLanguage(language === 'en' ? 'hi' : 'en')}
            style={({ pressed }) => [styles.languageToggle, pressed && styles.languagePressed]}
          >
            <Text numberOfLines={1} style={styles.languageText}>
              {language === 'en' ? 'EN | हिं' : 'हिं | EN'}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
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
          <GlassSheen />
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
    paddingVertical: spacing.sm + 2,
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
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: colors.primary,
  },
  brandMarkHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
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
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  lockBadgeText: { color: colors.primaryDark, fontFamily: fonts.medium, fontSize: 11 },
  languageToggle: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(13, 102, 89, 0.92)',
  },
  languagePressed: { backgroundColor: colors.primaryDark },
  languageText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12 },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: spacing.md,
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
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(217, 243, 237, 0.7)',
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
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(206, 232, 225, 0.75)',
  },
  slotFilled: {
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: 'rgba(191, 232, 222, 0.9)',
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
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(223, 249, 243, 0.6)',
  },
  statusPillDanger: {
    borderColor: 'rgba(245, 190, 190, 0.8)',
    backgroundColor: 'rgba(253, 232, 232, 0.8)',
  },
  statusPillText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
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
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  keySpacer: { width: KEY_SIZE, height: KEY_SIZE },
  keyDigit: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  keySecondary: { backgroundColor: 'rgba(206, 232, 225, 0.6)' },
  keyPressed: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 76, 66, 0.9)',
    transform: [{ scale: 0.95 }],
  },
  keyDeletePressed: {
    borderColor: 'rgba(245, 190, 190, 0.8)',
    backgroundColor: 'rgba(253, 232, 232, 0.85)',
    transform: [{ scale: 0.95 }],
  },
  keyDisabled: { opacity: 0.5 },
  keyDigitText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 24, lineHeight: 28 },
  keyLetters: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.5,
  },
  keyAction: {
    marginTop: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  keyIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  keyTextPressed: { color: '#fff' },
  unlockButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(13, 102, 89, 0.92)',
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 6,
    shadowOpacity: 0.06,
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  footerNote: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
