/** Must match coupon-backend/src/bonus/ad-reward.constants.ts.
 *  Purely a fallback for the brief moment before `/bonus/can-watch-ad` or
 *  `/bonus/limits` actually answers — every real screen uses the server's
 *  own `limit`/`maxAdViewsPerDay` value, never this constant, so it only
 *  needs to be a reasonable placeholder, not kept in lockstep with the
 *  server. Cooldown between views (3-5 min for the first 3, 15-30 min for
 *  the next 3, 1h+ after that) is entirely server-side — the client just
 *  displays whatever `nextAvailableInSec`/`reason` it's given. */
export const MAX_AD_VIEWS_PER_DAY = 10;
/** 100 просмотров × 0.01 TWA = 1 TWA */
export const VIEWS_PER_TWA = 100;
export const REWARD_PER_AD_VIEW = 0.01;

export function formatRewardPerViewLabel(locale = 'ru-RU'): string {
  return `+${REWARD_PER_AD_VIEW.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TWA`;
}

/** Formats a plain seconds count as `MM:SS` (or `H:MM:SS` past an hour, e.g.
 *  for a daily-limit reset). Purely a display helper — the seconds value
 *  itself always comes from the server (`nextAvailableInSec`), never
 *  computed locally; this never doubles as the source of truth. */
export function formatSecondsCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatTwaAmount(amount: number, locale = 'ru-RU'): string {
  const abs = Math.abs(amount);
  const maxFrac = abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
  return `${amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  })} TWA`;
}

/** Progress toward the next full 1 TWA from fractional balance. */
export function getProgressTowardOneTwa(balance: number): {
  viewsTowardOneTwa: number;
  viewsPerTwa: number;
  progress: number;
} {
  const viewsPerTwa = VIEWS_PER_TWA;
  const fractional = ((balance % 1) + 1) % 1;
  const viewsTowardOneTwa = Math.min(
    viewsPerTwa,
    Math.floor(fractional / REWARD_PER_AD_VIEW + 1e-9),
  );
  const progress = viewsPerTwa > 0 ? viewsTowardOneTwa / viewsPerTwa : 0;
  return { viewsTowardOneTwa, viewsPerTwa, progress };
}
