import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { NavigationState } from '@react-navigation/native';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { getInterstitialAdUnitId } from '@/shared/config/adsConfig';

const STORAGE_NEXT_ELIGIBLE_MS = '@interstitial_next_eligible_ms';

const STACK_MODALS = new Set(['BonusShop', 'MyPurchases', 'Settings']);

let lastFocusedMainRoute: string | undefined;

function getMainStackFocusedRoute(state: NavigationState | undefined): string | undefined {
  if (!state?.routes?.length) {
    return undefined;
  }
  const root = state.routes[state.index];
  if (!root || root.name !== 'MainStack' || !root.state || typeof root.state.index !== 'number') {
    return undefined;
  }
  const inner = root.state as NavigationState;
  const innerRoute = inner.routes[inner.index];
  return innerRoute?.name;
}

async function isPastCooldown(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_NEXT_ELIGIBLE_MS);
  if (!raw) {
    return true;
  }
  return Date.now() >= Number(raw);
}

async function scheduleNextCooldownWindow(): Promise<void> {
  const minMs = 3 * 60 * 1000;
  const next = Date.now() + minMs;
  await AsyncStorage.setItem(STORAGE_NEXT_ELIGIBLE_MS, String(next));
}

/**
 * NavigationContainer.onStateChange — interstitial при возврате с модальных экранов на табы,
 * не чаще чем раз в 2–3 минуты (случайный интервал).
 */
export async function handleRootNavigationState(state?: NavigationState): Promise<void> {
  if (Platform.OS === 'web' || !state) {
    return;
  }

  const focused = getMainStackFocusedRoute(state);
  const prev = lastFocusedMainRoute;
  lastFocusedMainRoute = focused;

  if (!focused) {
    return;
  }

  if (!(prev && STACK_MODALS.has(prev) && focused === 'MainTabs')) {
    return;
  }

  if (!(await isPastCooldown())) {
    return;
  }

  const ad = InterstitialAd.createForAdRequest(getInterstitialAdUnitId());

  await new Promise<void>((resolve) => {
    let settled = false;
    const unsubs: (() => void)[] = [];
    const clear = () => {
      while (unsubs.length) {
        const u = unsubs.pop();
        u?.();
      }
    };
    const done = () => {
      if (!settled) {
        settled = true;
        clear();
        resolve();
      }
    };

    unsubs.push(
      ad.addAdEventListener(AdEventType.ERROR, () => {
        done();
      })
    );

    unsubs.push(
      ad.addAdEventListener(AdEventType.LOADED, () => {
        void ad.show().catch(() => {
          done();
        });
      })
    );

    unsubs.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        void scheduleNextCooldownWindow();
        done();
      })
    );

    ad.load();
  });
}
