import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MemberRecord } from '@/data/repositories/phase2-repository';
import { MemberProfilePanel } from '@/features/members/member-profile-panel';
import { useAppSession } from '@/features/session/app-session-context';
import { LoadingState, Notice } from '@/ui/components/core-controls';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function MemberProfileRoute() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { getPhase2Repository } = useAppSession();
  const { t } = useTranslation();
  const [member, setMember] = useState<MemberRecord | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void refreshKey;
      let active = true;
      void getPhase2Repository()
        .getMember(memberId)
        .then((row) => {
          if (!active) return;
          setMember(row);
          setError(!row);
        })
        .catch(() => active && setError(true))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [getPhase2Repository, memberId, refreshKey]),
  );
  return (
    <OperationalShell active="members" title={t('memberProfile')}>
      {loading ? <LoadingState label={t('loading')} /> : null}
      {error ? <Notice danger>{t('memberLoadFailed')}</Notice> : null}
      {!loading && member ? (
        <MemberProfilePanel member={member} onChanged={() => setRefreshKey((key) => key + 1)} />
      ) : null}
    </OperationalShell>
  );
}
