import { useTranslation } from 'react-i18next';

import { PlanForm } from '@/features/plans/plan-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function NewPlanRoute() {
  const { t } = useTranslation();
  return (
    <OperationalShell active="more" title={t('newPlan')}>
      <PlanForm />
    </OperationalShell>
  );
}
