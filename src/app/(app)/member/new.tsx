import { useTranslation } from 'react-i18next';

import { MemberForm } from '@/features/members/member-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function NewMemberRoute() {
  const { t } = useTranslation();
  return (
    <OperationalShell active="members" title={t('newMember')}>
      <MemberForm />
    </OperationalShell>
  );
}
