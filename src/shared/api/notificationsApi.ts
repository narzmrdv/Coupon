import { apiClient } from '@/shared/lib/api/apiClient';
import { API_CONFIG } from '@/shared/config/api';
import type {
  JackpotNotifyState,
  NotificationPreferences,
  RegisterPushTokenRequest,
} from '@/shared/types/notifications';

class NotificationsApi {
  async registerPushToken(data: RegisterPushTokenRequest): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.NOTIFICATIONS.REGISTER_TOKEN, data);
  }

  async getPreferences(): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>(API_CONFIG.ENDPOINTS.NOTIFICATIONS.PREFERENCES);
  }

  async updatePreferences(prefs: NotificationPreferences): Promise<void> {
    await apiClient.put(API_CONFIG.ENDPOINTS.NOTIFICATIONS.PREFERENCES, prefs);
  }

  /** Broadcasts "come play" to other users — shared 5-minute cooldown and a
   *  lifetime cap of a few sends, both global (same for every player), not
   *  per-round. The response echoes the resulting state so the UI can
   *  update immediately instead of waiting for the next socket push. */
  async triggerJackpotAlert(): Promise<Partial<JackpotNotifyState> | undefined> {
    return apiClient.post<Partial<JackpotNotifyState> | undefined>(
      API_CONFIG.ENDPOINTS.NOTIFICATIONS.JACKPOT_ALERT,
    );
  }
}

export const notificationsApi = new NotificationsApi();
