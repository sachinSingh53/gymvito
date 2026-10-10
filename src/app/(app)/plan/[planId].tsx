import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlanForm } from '@/features/plans/plan-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function EditPlanRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { t } = useTranslation();
  return (
    <OperationalShell active="more" backHref="/plans" canGoBack title={t('editPlan')}>
      <PlanForm planId={planId} />
    </OperationalShell>
  );
}
