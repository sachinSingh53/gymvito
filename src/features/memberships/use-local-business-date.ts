import { AppState } from 'react-native';
import { useEffect, useState } from 'react';

import { dateOnlyAtInstant, type DateOnly } from '@/domain/dates/date-rules';

export function useLocalBusinessDate(timeZone: string): DateOnly {
  const [today, setToday] = useState<DateOnly>(() => dateOnlyAtInstant(new Date(), timeZone));

  useEffect(() => {
    const read = () => dateOnlyAtInstant(new Date(), timeZone);
    const refresh = () => setToday(read());
    refresh();
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [timeZone]);

  return today;
}
