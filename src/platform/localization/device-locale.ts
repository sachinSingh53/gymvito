import { getCalendars, getLocales } from 'expo-localization';
import { AppState, type AppStateStatus } from 'react-native';

export type DeviceLocaleSnapshot = Readonly<{
  locale: string;
  languageTag: string;
  timeZone: string;
  calendar: string;
  uses24HourClock: boolean;
}>;

export function readDeviceLocale(): DeviceLocaleSnapshot {
  const locale = getLocales()[0];
  const calendar = getCalendars()[0];
  return {
    locale: locale?.languageTag ?? 'en-IN',
    languageTag: locale?.languageTag ?? 'en-IN',
    timeZone: calendar?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    calendar: calendar?.calendar ?? 'gregory',
    uses24HourClock: calendar?.uses24hourClock ?? false,
  };
}

export function observeDeviceLocale(
  onRefresh: (snapshot: DeviceLocaleSnapshot) => void,
): () => void {
  let priorState = AppState.currentState;
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (priorState !== 'active' && nextState === 'active') onRefresh(readDeviceLocale());
    priorState = nextState;
  });
  return () => subscription.remove();
}
