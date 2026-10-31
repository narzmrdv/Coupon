import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { getRewardedAdUnitId } from '@/shared/config/adsConfig';

export type RewardedAdResult = {
  success: boolean;
  earned: boolean;
  error?: string;
};

/** 2с → 4с → 8с → 16с → 32с между попытками загрузки */
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 32000];

let readyAd: RewardedAd | null = null;
let loadingAd: RewardedAd | null = null;
let preloadGeneration = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFormatMismatchError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  const m = message.toLowerCase();
  return m.includes("doesn't match format") || m.includes('does not match format');
}

function createRewardedInstance(customData?: string): RewardedAd {
  return RewardedAd.createForAdRequest(
    getRewardedAdUnitId(),
    customData ? { customData } : undefined,
  );
}

function loadRewardedWithBackoff(ad: RewardedAd, attempt = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const unsubs: (() => void)[] = [];

    const finish = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      unsubs.forEach((u) => u());
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    unsubs.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => finish()),
    );
    unsubs.push(
      ad.addAdEventListener(AdEventType.ERROR, (e) =>
        finish(new Error(e?.message || 'load error')),
      ),
    );

    ad.load();
  }).catch(async (err: Error) => {
    if (attempt >= RETRY_DELAYS_MS.length) {
      throw err;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
    return loadRewardedWithBackoff(ad, attempt + 1);
  });
}

/** Загружает следующую рекламу в фоне (пока показывается readyAd). */
function scheduleNextPreload(): void {
  if (loadingAd) {
    return;
  }
  const gen = ++preloadGeneration;
  const ad = createRewardedInstance();
  loadingAd = ad;

  void loadRewardedWithBackoff(ad)
    .then(() => {
      if (gen !== preloadGeneration) {
        return;
      }
      if (!readyAd?.loaded) {
        readyAd = ad;
        loadingAd = null;
        return;
      }
      loadingAd = ad;
    })
    .catch(() => {
      if (gen === preloadGeneration) {
        loadingAd = null;
      }
    });
}

export function preloadRewardedAd(): void {
  if (readyAd?.loaded || loadingAd) {
    if (!loadingAd && !readyAd?.loaded) {
      scheduleNextPreload();
    }
    return;
  }
  const gen = ++preloadGeneration;
  const ad = createRewardedInstance();
  loadingAd = ad;
  void loadRewardedWithBackoff(ad)
    .then(() => {
      if (gen !== preloadGeneration) {
        return;
      }
      readyAd = ad;
      loadingAd = null;
      scheduleNextPreload();
    })
    .catch(() => {
      if (gen === preloadGeneration) {
        loadingAd = null;
      }
      setTimeout(() => preloadRewardedAd(), RETRY_DELAYS_MS[0]);
    });
}

function showLoadedRewarded(rewarded: RewardedAd): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    let settled = false;
    let earned = false;
    const unsubs: (() => void)[] = [];

    const finish = (result: RewardedAdResult) => {
      if (settled) {
        return;
      }
      settled = true;
      unsubs.forEach((u) => u());
      resolve(result);
    };

    unsubs.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
    );

    unsubs.push(
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        finish({ success: true, earned });
      }),
    );

    unsubs.push(
      rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
        finish({ success: false, earned, error: err?.message || 'ad error' });
      }),
    );

    rewarded
      .show()
      .catch((e: Error) =>
        finish({ success: false, earned: false, error: e?.message || 'show failed' }),
      );
  });
}

async function loadShowWithRetry(): Promise<RewardedAdResult> {
  let lastError = 'Ad failed to load';

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ad = createRewardedInstance();
    try {
      await loadRewardedWithBackoff(ad, 0);
      return await showLoadedRewarded(ad);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : lastError;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  return { success: false, earned: false, error: lastError };
}

/**
 * Rewarded: показ из предзагрузки, следующая грузится параллельно; fallback — backoff 2→32с.
 * Если передан customData — загружается свежий экземпляр с customData для SSV.
 */
export async function showRewardedAd(
  customData?: string,
  _userId?: string,
): Promise<RewardedAdResult> {
  const adUnitId = getRewardedAdUnitId();
  if (!adUnitId.includes('/')) {
    return {
      success: false,
      earned: false,
      error: 'Invalid rewarded ad unit id (expected ca-app-pub-xxx/yyy)',
    };
  }

  preloadGeneration += 1;
  scheduleNextPreload();

  let result: RewardedAdResult;

  if (customData) {
    // Load fresh instance so AdMob SSV callback carries our customData
    const freshAd = createRewardedInstance(customData);
    try {
      await loadRewardedWithBackoff(freshAd);
      result = await showLoadedRewarded(freshAd);
    } catch (e: unknown) {
      result = { success: false, earned: false, error: e instanceof Error ? e.message : 'Ad failed to load' };
    }
  } else {
    let instance: RewardedAd | null = null;
    if (readyAd?.loaded) {
      instance = readyAd;
      readyAd = null;
    } else if (loadingAd?.loaded) {
      instance = loadingAd;
      loadingAd = null;
    }
    if (instance) {
      result = await showLoadedRewarded(instance);
    } else {
      result = await loadShowWithRetry();
    }
  }

  scheduleNextPreload();
  preloadRewardedAd();

  if (!result.success && isFormatMismatchError(result.error)) {
    console.warn('[AdMob] Rewarded format mismatch — check AdMob unit type is Rewarded.');
  }

  return result;
}

export function isRewardedAdPreloaded(): boolean {
  return readyAd?.loaded === true || loadingAd?.loaded === true;
}
