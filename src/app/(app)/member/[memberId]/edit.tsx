import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MemberForm } from '@/features/members/member-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function EditMemberRoute() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { t } = useTranslation();
  return (
    <OperationalShell active="members" title={t('editMember')}>
      <MemberForm memberId={memberId} />
    </OperationalShell>
  );
}
