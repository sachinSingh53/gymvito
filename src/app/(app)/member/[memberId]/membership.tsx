import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MembershipForm } from '@/features/memberships/membership-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function MembershipRoute() {
  const { memberId, renewFrom } = useLocalSearchParams<{
    memberId: string;
    renewFrom?: string;
  }>();
  const { t } = useTranslation();
  return (
    <OperationalShell
      active="members"
      title={t(renewFrom ? 'renewMembership' : 'enrollMembership')}
    >
      <MembershipForm memberId={memberId} priorMembershipId={renewFrom} />
    </OperationalShell>
  );
}
