import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigates from outside the React tree (e.g. a push-notification tap
 * handler, which fires long before/after any screen is mounted). The nested
 * stack/tab route names used here (MainStack -> MainTabs -> Chat, etc.)
 * aren't represented in the global ReactNavigation.RootParamList typing —
 * that typing already only loosely matches the real navigator tree defined
 * in MainStack.tsx — so this intentionally bypasses strict typing rather
 * than fighting a pre-existing mismatch.
 */
export function navigateFromNotification(name: string, params?: object): void {
  if (!navigationRef.isReady()) return;
  (navigationRef.navigate as (routeName: string, params?: object) => void)(name, params);
}
