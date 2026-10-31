export interface NotificationPreferences {
  chatEnabled: boolean;
  jackpotEnabled: boolean;
}

export interface RegisterPushTokenRequest {
  token: string;
  platform: 'ios' | 'android';
}

/** Shared (not per-user) "Call to game" cooldown/limit state — same for
 *  every player, pushed via the `jackpot:state` socket event and returned
 *  by the trigger endpoint. See the backend contract notes in
 *  notificationsApi.ts. */
export interface JackpotNotifyState {
  /** Epoch ms when the shared cooldown ends; null = available right now. */
  cooldownUntil: number | null;
  /** Total number of times the alert has been sent, globally. */
  sendCount: number;
  /** Sends allowed before the button permanently shows "Sent". */
  maxSends: number;
}
