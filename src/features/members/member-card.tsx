import { useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberPhotoInput } from '@/data/repositories/phase2-repository';
import type { MembershipDirectoryItem } from '@/data/repositories/phase3-repository';
import type { MemberFinanceSummary } from '@/data/repositories/phase4-repository';
import { daysBetweenDateOnly, type DateOnly } from '@/domain/dates/date-rules';
import { memberInitials } from '@/domain/members/member';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { memberPhotoDataUri } from '@/platform/images/member-photo';
import { MaterialSymbol } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

type RegionalSettings = Readonly<{
  language: 'en' | 'hi';
  currencyCode: string;
  dateFormat: 'day-month-year' | 'month-day-year' | 'year-month-day';
}>;

type Tone = 'neutral' | 'active' | 'warning' | 'danger';

const EXPIRY_ALERT_DAYS = 7;
const WHATSAPP_GREEN = '#25d366';

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

export function MemberCard({
  member,
  finance,
  photo,
  regionalSettings,
  today,
  selected = false,
  onPress,
}: {
  member: MembershipDirectoryItem;
  finance?: MemberFinanceSummary;
  photo?: MemberPhotoInput;
  regionalSettings?: RegionalSettings;
  today?: DateOnly;
  selected?: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation();
  const photoUri = useMemo(() => (photo ? memberPhotoDataUri(photo) : null), [photo]);
  const featured = member.current ?? member.upcoming ?? member.latest;
  const balanceMinor = finance?.balanceMinor ?? 0;
  const overdueMinor = finance?.overdueMinor ?? 0;
  const hasInvoice = (finance?.invoiceCount ?? 0) > 0;
  const expired = member.status === 'expired';
  const scheduled = featured?.status === 'scheduled';
  const daysLeft =
    today && member.current && member.status === 'active'
      ? daysBetweenDateOnly(today, member.current.endDate)
      : null;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRY_ALERT_DAYS;
  const money = (minor: number) =>
    regionalSettings ? formatMoneyMinor(minor, regionalSettings) : String(minor / 100);
  const featuredDate = featured ? (scheduled ? featured.startDate : featured.endDate) : null;
  const formattedDate =
    featuredDate && regionalSettings
      ? formatDateOnly(featuredDate, regionalSettings)
      : featuredDate;

  const chip: { label: string; icon: string; tone: Tone } =
    overdueMinor > 0 && !expired
      ? { label: t('amountDue', { amount: money(balanceMinor) }), icon: 'warning', tone: 'danger' }
      : member.status === 'archived'
        ? { label: t('archived'), icon: 'inventory_2', tone: 'neutral' }
        : member.status === 'no-membership'
          ? { label: t('memberStatusNoMembership'), icon: 'person_off', tone: 'neutral' }
          : member.status === 'upcoming'
            ? { label: t('membershipStatusScheduled'), icon: 'schedule', tone: 'warning' }
            : expired
              ? { label: t('membershipStatusExpired'), icon: 'cancel', tone: 'danger' }
              : expiringSoon
                ? {
                    label:
                      daysLeft === 0
                        ? t('expiresToday')
                        : t('expiresInDays', { count: daysLeft ?? 0 }),
                    icon: 'alarm',
                    tone: 'warning',
                  }
                : { label: t('active'), icon: 'verified', tone: 'active' };

  const dateIcon = expired
    ? 'event_busy'
    : scheduled || expiringSoon
      ? 'schedule'
      : hasInvoice && balanceMinor === 0
        ? 'event_available'
        : 'event';
  const dateLabel = expired ? t('expiredOnLabel') : scheduled ? t('startsLabel') : t('expiryLabel');
  const dateValue =
    daysLeft === 0 ? t('todayWithDate', { date: formattedDate }) : (formattedDate ?? '');

  const billing: { label: string; icon?: string; danger?: boolean } | null =
    overdueMinor > 0
      ? {
          label: expired ? t('amountDue', { amount: money(balanceMinor) }) : t('overdue'),
          danger: true,
        }
      : balanceMinor > 0
        ? { label: t('amountDue', { amount: money(balanceMinor) }), danger: true }
        : hasInvoice
          ? { label: t('paidInFull'), icon: 'check_circle' }
          : featured
            ? { label: t('renewMembership') }
            : { label: t('createInPhase3') };

  const avatarTone =
    chip.tone === 'warning'
      ? styles.avatarWarning
      : expired || chip.tone === 'neutral'
        ? styles.avatarMuted
        : null;
  const avatarTextTone =
    chip.tone === 'warning'
      ? styles.initialsWarning
      : expired || chip.tone === 'neutral'
        ? styles.initialsMuted
        : null;

  return (
    <Pressable
      accessibilityLabel={t('openMemberProfile', { name: member.name })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        expired && styles.cardDimmed,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        {photoUri ? (
          <Image
            accessibilityLabel={t('memberPhoto', { name: member.name })}
            source={{ uri: photoUri }}
            style={styles.avatarPhoto}
          />
        ) : (
          <View style={[styles.avatar, avatarTone]}>
            <Text style={[styles.initials, avatarTextTone]}>{memberInitials(member.name)}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {member.name}
            </Text>
            <View style={[styles.chip, chipStyles[chip.tone]]}>
              <MaterialSymbol color={chipTextColors[chip.tone]} name={chip.icon} size={14} />
              <Text
                numberOfLines={1}
                style={[
                  styles.chipText,
                  { color: chipTextColors[chip.tone] },
                  chip.icon === 'warning' && styles.chipTextUpper,
                ]}
              >
                {chip.label}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.code}>{member.memberCode}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {featured?.planName ?? t('noMembership')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.statusStrip}>
        <View style={styles.statusDate}>
          <MaterialSymbol
            color={expired ? colors.danger : colors.outline}
            name={dateIcon}
            size={16}
          />
          <Text numberOfLines={1} style={styles.statusText}>
            {featured ? (
              <>
                {dateLabel}{' '}
                <Text
                  style={[
                    styles.statusDateValue,
                    expired && styles.textDanger,
                    expiringSoon && styles.textWarning,
                  ]}
                >
                  {dateValue}
                </Text>
              </>
            ) : (
              t('membershipNotStarted')
            )}
          </Text>
        </View>
        {billing ? (
          <View style={styles.statusActionRow}>
            {billing.icon ? (
              <MaterialSymbol color={colors.primary} name={billing.icon} size={14} />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.statusAction, billing.danger && styles.textDanger]}
            >
              {billing.label}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.contactRow}>
        <View style={styles.contactIdentity}>
          <MaterialSymbol color={colors.outline} name={member.phone ? 'call' : 'mail'} size={16} />
          <Text numberOfLines={1} style={styles.contact}>
            {member.phone || member.email || t('noContact')}
          </Text>
        </View>
        <View style={styles.actions}>
          {member.phone ? (
            <>
              <Pressable
                accessibilityLabel={t('callMemberNamed', { name: member.name })}
                accessibilityRole="button"
                hitSlop={4}
                onPress={() => void Linking.openURL(`tel:${member.phone.replace(/\s/g, '')}`)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
              >
                <MaterialSymbol color={colors.primaryDark} name="call" size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel={t('whatsappMemberNamed', { name: member.name })}
                accessibilityRole="button"
                hitSlop={4}
                onPress={() => void Linking.openURL(whatsappUrl(member.phone))}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
              >
                <MaterialSymbol color={WHATSAPP_GREEN} name="chat" size={22} />
              </Pressable>
            </>
          ) : null}
          <View style={styles.iconButton}>
            <MaterialSymbol color={colors.outline} name="chevron_right" size={22} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const chipTextColors: Record<Tone, string> = {
  neutral: colors.textMuted,
  active: colors.primary,
  warning: colors.warningText,
  danger: colors.danger,
};

const chipStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceContainer },
  active: { backgroundColor: colors.surfaceLow },
  warning: { backgroundColor: '#f5e6c4' },
  danger: { backgroundColor: colors.dangerSurface },
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardDimmed: { opacity: 0.92 },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceLow },
  pressed: { opacity: 0.78 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
  },
  avatarPhoto: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceHigh },
  avatarWarning: { backgroundColor: '#f2e3c6' },
  avatarMuted: { backgroundColor: colors.surfaceContainer },
  initials: { color: colors.primary, fontFamily: fonts.bold, fontSize: 18 },
  initialsWarning: { color: colors.warningText },
  initialsMuted: { color: colors.text },
  identity: { minWidth: 0, flex: 1, gap: 4 },
  nameRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { minWidth: 0, flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  chip: {
    maxWidth: '55%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  chipText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11, lineHeight: 15 },
  chipTextUpper: { textTransform: 'uppercase', letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    color: colors.textMuted,
    backgroundColor: colors.surfaceContainer,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  meta: { minWidth: 0, flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  statusStrip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  statusDate: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  statusDateValue: { color: colors.text, fontFamily: fonts.semibold },
  textDanger: { color: colors.danger },
  textWarning: { color: colors.warningText },
  statusActionRow: {
    minWidth: 0,
    maxWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusAction: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  contactRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  contactIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contact: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  actions: { flexDirection: 'row', alignItems: 'center', marginRight: -10 },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  iconPressed: { backgroundColor: colors.surfaceContainer },
});
