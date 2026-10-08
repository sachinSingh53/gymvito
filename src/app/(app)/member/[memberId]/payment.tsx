import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PaymentForm } from '@/features/payments/payment-form';
import { OperationalShell } from '@/ui/components/operational-shell';

export default function MemberPaymentRoute() {
  const { memberId, invoiceId } = useLocalSearchParams<{ memberId: string; invoiceId?: string }>();
  const { t } = useTranslation();
  return (
    <OperationalShell active="payments" title={t('recordPayment')}>
      <PaymentForm invoiceId={invoiceId} memberId={memberId} />
    </OperationalShell>
  );
}
