import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsApi } from '@/shared/api/notificationsApi';
import type { NotificationPreferences } from '@/shared/types/notifications';
import { navigateFromNotification } from '@/shared/lib/navigation/navigationRef';

export const CHAT_NOTIFICATIONS_KEY = '@notif_chat_enabled';
export const JACKPOT_NOTIFICATIONS_KEY = '@notif_jackpot_enabled';

// Foreground display behavior — without this, notifications received while
// the app is open never show anything (Expo's default is to suppress them).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistrationResult =
  | { status: 'success'; token: string }
  | { status: 'not-a-device' }
  | { status: 'permission-denied' }
  | { status: 'missing-project-id' }
  | { status: 'token-error'; message: string }
  | { status: 'backend-error'; message: string; requestUrl?: string };

/**
 * Requests permission (no-ops if already asked before) and registers the
 * device's Expo push token with the backend. Call once the user is
 * authenticated — the register endpoint needs a valid JWT.
 *
 * Every failure mode is returned instead of thrown, and every call site
 * that doesn't care about the result can just ignore it — but this makes
 * the reason inspectable (e.g. via a manual "test" button in Settings)
 * instead of silently vanishing into a console log nobody on a real device
 * build can see.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) return { status: 'not-a-device' }; // simulators/emulators don't have real push tokens

  if (Platform.OS === 'android') {
    // MAX (not DEFAULT) is what actually gets Android to show a heads-up
    // banner + sound immediately on arrival — some OEM skins otherwise defer
    // lower-importance channels into the notification shade, which reads as
    // "the push arrived late" even when delivery itself was instant.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return { status: 'permission-denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[Push] No EAS projectId configured — cannot get a push token');
    return { status: 'missing-project-id' };
  }

  let token: string;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenResponse.data;
  } catch (error: any) {
    if (__DEV__) console.error('[Push] Failed to get push token:', error);
    return { status: 'token-error', message: error?.message ?? String(error) };
  }

  try {
    await notificationsApi.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch (error: any) {
    if (__DEV__) console.error('[Push] Failed to register push token with backend:', error);
    return {
      status: 'backend-error',
      message: error?.message ?? String(error),
      requestUrl: error?.requestUrl,
    };
  }

  return { status: 'success', token };
}

/**
 * Local on/off switches for chat/jackpot notifications, kept in AsyncStorage
 * so the UI reflects the choice instantly, and mirrored to the backend so it
 * actually stops sending pushes (not just hides them once received).
 */
export async function getLocalNotificationPreferences(): Promise<NotificationPreferences> {
  const [chat, jackpot] = await AsyncStorage.multiGet([
    CHAT_NOTIFICATIONS_KEY,
    JACKPOT_NOTIFICATIONS_KEY,
  ]);
  return {
    chatEnabled: chat[1] !== 'false',
    jackpotEnabled: jackpot[1] !== 'false',
  };
}

export async function setNotificationPreference(
  key: 'chatEnabled' | 'jackpotEnabled',
  enabled: boolean,
): Promise<void> {
  const storageKey = key === 'chatEnabled' ? CHAT_NOTIFICATIONS_KEY : JACKPOT_NOTIFICATIONS_KEY;
  await AsyncStorage.setItem(storageKey, String(enabled));
  const current = await getLocalNotificationPreferences();
  const next = { ...current, [key]: enabled };
  try {
    await notificationsApi.updatePreferences(next);
  } catch (error) {
    if (__DEV__) console.error('[Push] Failed to sync notification preference to server:', error);
    // Not fatal — the local toggle still takes effect for anything decided
    // on-device; the server-side mirror will catch up next time this succeeds.
  }
}

/**
 * Where tapping a notification should take the user, based on a `type`
 * field the backend is expected to put in the notification's `data`
 * payload ('chat' for an admin message, 'jackpot' for a jackpot alert).
 * Unrecognized/missing types are left alone — the app still opens normally.
 */
function routeNotificationTap(data: unknown): void {
  const type = (data as { type?: string } | undefined)?.type;
  if (type === 'chat') {
    navigateFromNotification('MainStack', { screen: 'MainTabs', params: { screen: 'Chat' } });
  } else if (type === 'jackpot') {
    navigateFromNotification('MainStack', { screen: 'WheelOfFortune' });
  }
}

/** Call once the navigation container is mounted — handles the case where
 * the app was cold-started by tapping a notification (a plain
 * addNotificationResponseReceivedListener misses this one, by design). */
export function checkInitialNotificationRoute(): void {
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    routeNotificationTap(response.notification.request.content.data);
  });
}

/** Call once at app start — handles taps while the app is already running
 * or backgrounded. Returns an unsubscribe function for cleanup. */
export function setupNotificationResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    routeNotificationTap(response.notification.request.content.data);
  });
  return () => sub.remove();
}
