import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  AppState,
  AppStateStatus,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Clock } from 'lucide-react-native';
import { showRewardedAd, preloadRewardedAd } from '@/shared/lib/admob';
import { useBonus } from '@/shared/lib/hooks/useBonus';
import { useLanguage } from '@/shared/lib/hooks';
import {
  formatTwaAmount,
  formatSecondsCountdown,
  REWARD_PER_AD_VIEW,
  MAX_AD_VIEWS_PER_DAY,
} from '@/shared/constants/adRewards';
import { useProfile } from '@/shared/lib/hooks';
import type { AdWatchPauseReason, CanWatchAdResponse } from '@/shared/types/bonus';
import { wp, hp, fontSize } from '@/shared/lib/responsive';

// Button graphic's own aspect ratio (icon + "+0,01 TWA" baked into the
// image; the "Посмотреть рекламу" title is a separate overlay below so it
// can be translated) — used so the button scales to the row's width
// without distorting. Matches the edited reklama_btn.png (926×372).
const AD_BUTTON_IMAGE_RATIO = 926 / 372;

interface RewardedAdButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

function isAlreadyRewardedMessage(msg: string | undefined): boolean {
  if (!msg) {
    return false;
  }
  const m = msg.toLowerCase();
  return m.includes('already rewarded') || m.includes('уже') || m.includes('вже');
}

function normalizeRewardAmount(amount: number | undefined): number {
  if (amount === undefined || !Number.isFinite(amount) || amount > 0.1) {
    return REWARD_PER_AD_VIEW;
  }
  return amount;
}

export const RewardedAdButton: React.FC<RewardedAdButtonProps> = ({ onSuccess, onError }) => {
  const { t, language } = useLanguage();
  const copy = t.main.balance;
  // "Watch ad" is short and fits on one line, so English can run bigger;
  // "Посмотреть"/"Переглянути" are long single words that need a smaller
  // size to fit their own line without RN force-breaking mid-word.
  const titleFontSize = language === 'en' ? fontSize(18) : fontSize(12);
  const { checkCanWatchAd, requestAdView, claimAdReward, earnAdViewBonus, fetchBalance, fetchLimits } =
    useBonus();
  const { data: profile } = useProfile();
  const [loading, setLoading] = useState(false);
  // Сервер — единственный источник истины по паузам между просмотрами.
  // `quota` — последний известный ответ can-watch-ad; `secondsLeft` — чисто
  // отображаемый локальный отсчёт, который просто тикает вниз от того, что
  // прислал сервер, и по достижении нуля перепроверяет состояние заново.
  const [quota, setQuota] = useState<CanWatchAdResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const reasonMessage = useCallback(
    (reason: AdWatchPauseReason | null | undefined, timeLabel: string, limit: number): string => {
      switch (reason) {
        case 'view_pause':
          return copy.pauseViewMessage.replace('{time}', timeLabel);
        case 'block_pause':
          return copy.pauseBlockMessage.replace('{time}', timeLabel);
        case 'daily_limit':
          return copy.pauseDailyLimitMessage.replace('{limit}', String(limit));
        default:
          return copy.limitReachedMessage;
      }
    },
    [copy.pauseViewMessage, copy.pauseBlockMessage, copy.pauseDailyLimitMessage, copy.limitReachedMessage],
  );

  const refreshQuota = useCallback(async () => {
    const result = await checkCanWatchAd();
    setQuota(result);
    setSecondsLeft(result ? Math.max(0, result.nextAvailableInSec || 0) : 0);
    return result;
  }, [checkCanWatchAd]);

  // Запрашиваем can-watch-ad при входе на экран (фокус) и при возврате
  // приложения из фона — именно так сервер узнаёт актуальную паузу вместо
  // того, чтобы полагаться на состояние, пережившее уход с экрана.
  useFocusEffect(
    useCallback(() => {
      void refreshQuota();
      preloadRewardedAd();
    }, [refreshQuota]),
  );

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshQuota();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refreshQuota]);

  // Локальный тикер — только отображение. Когда доходит до нуля, не решаем
  // сами, что реклама уже доступна, а перепроверяем у сервера.
  const zeroHandledRef = useRef(false);
  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    zeroHandledRef.current = false;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!zeroHandledRef.current) {
            zeroHandledRef.current = true;
            void refreshQuota();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft > 0, refreshQuota]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = !!quota && !quota.canWatch;
  const isDisabled = loading || blocked;

  const finishRewardUi = useCallback(
    async (creditedAmount: number) => {
      await fetchBalance();
      await fetchLimits();
      await refreshQuota();
      const displayAmount = formatTwaAmount(creditedAmount);
      Alert.alert(
        t.common.success,
        t.main.balance.bonusReceived.replace('{amount}', displayAmount),
        [{ text: t.main.balance.great }],
      );
      onSuccess?.();
    },
    [fetchBalance, fetchLimits, refreshQuota, t.common.success, t.main.balance.bonusReceived, t.main.balance.great, onSuccess],
  );

  // Пауза пришла с 429 на попытке начисления (не с обычного can-watch-ad) —
  // показываем сообщение сервера и сразу заводим отсчёт от его
  // nextAvailableInSec, а не считаем это рядовой ошибкой.
  const handlePauseResponse = useCallback(
    (result: { nextAvailableInSec?: number; reason?: AdWatchPauseReason; error?: string }) => {
      const secs = Math.max(0, result.nextAvailableInSec ?? 0);
      setSecondsLeft(secs);
      setQuota((prev) => ({
        canWatch: false,
        viewsToday: prev?.viewsToday ?? 0,
        limit: prev?.limit ?? MAX_AD_VIEWS_PER_DAY,
        nextAvailableInSec: secs,
        reason: result.reason ?? prev?.reason ?? null,
      }));
      Alert.alert(
        copy.limitReached,
        result.error || reasonMessage(result.reason, formatSecondsCountdown(secs), quota?.limit ?? MAX_AD_VIEWS_PER_DAY),
      );
      onError?.(result.error || result.reason || 'Ad pause not over');
    },
    [copy.limitReached, reasonMessage, quota?.limit, onError],
  );

  const handleWatchAd = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t.common.error, copy.adError);
      return;
    }

    if (quota && !quota.canWatch) {
      // Кнопка и так должна быть заблокирована в этом состоянии — это
      // подстраховка на случай гонки между рендером и стейтом.
      Alert.alert(copy.limitReached, reasonMessage(quota.reason, formatSecondsCountdown(secondsLeft), quota.limit));
      return;
    }

    setLoading(true);
    try {
      let adViewId: string | undefined;
      let customData: string | undefined;

      try {
        const serverQuota = await checkCanWatchAd();
        if (serverQuota) {
          setQuota(serverQuota);
          setSecondsLeft(Math.max(0, serverQuota.nextAvailableInSec || 0));
          if (!serverQuota.canWatch) {
            Alert.alert(
              copy.limitReached,
              reasonMessage(
                serverQuota.reason,
                formatSecondsCountdown(serverQuota.nextAvailableInSec),
                serverQuota.limit,
              ),
            );
            return;
          }
        }
        try {
          const adReq = await requestAdView('admob');
          if (adReq?.customData && adReq.adViewId) {
            adViewId = adReq.adViewId;
            customData = adReq.customData;
          }
        } catch {
          /* SSV-запрос не прошёл — покажем рекламу без customData */
        }
      } catch {
        /* canWatchAd недоступен — всё равно пробуем показать рекламу */
      }

      const adResult = await showRewardedAd(
        customData,
        profile?.id ? String(profile.id) : undefined,
      );
      if (!adResult.success) {
        Alert.alert(t.common.error, adResult.error || copy.adError);
        onError?.(adResult.error || 'Ad failed');
        return;
      }
      if (!adResult.earned) {
        return;
      }

      if (adViewId) {
        let claim = await claimAdReward(adViewId);
        if (claim.nextAvailableInSec !== undefined) {
          handlePauseResponse(claim);
          return;
        }
        // SSV callback from AdMob may not have arrived yet — retry after short delay
        if (!claim.success && !isAlreadyRewardedMessage(claim.error)) {
          await new Promise<void>((resolve) => setTimeout(resolve, 3000));
          claim = await claimAdReward(adViewId);
          if (claim.nextAvailableInSec !== undefined) {
            handlePauseResponse(claim);
            return;
          }
        }
        if (claim.success || isAlreadyRewardedMessage(claim.error)) {
          await finishRewardUi(normalizeRewardAmount(claim.rewardAmount));
          return;
        }
      }

      const earn = await earnAdViewBonus();
      if (earn.nextAvailableInSec !== undefined) {
        handlePauseResponse(earn);
        return;
      }
      if (earn.success) {
        await finishRewardUi(normalizeRewardAmount(earn.transaction?.amount));
        return;
      }

      // Show friendly message instead of raw HTTP error text
      const errorMsg =
        earn.error && !earn.error.includes('status code') ? earn.error : copy.bonusError;
      Alert.alert(t.common.error, errorMsg);
      onError?.(earn.error || 'Earn failed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : copy.generalError;
      Alert.alert(t.common.error, message);
      onError?.(message);
    } finally {
      setLoading(false);
      preloadRewardedAd();
    }
  };

  const timeLabel = formatSecondsCountdown(secondsLeft);

  if (blocked) {
    // Cooldown pill — just the countdown, no "next ad in" phrase: on
    // RU/UK that text left no room for the timer digits to actually show.
    return (
      <View
        style={styles.cooldownPill}
        accessibilityLabel={t.main.home.nextAdIn.replace('{time}', timeLabel)}>
        <Clock size={wp(18)} color="#FFFFFF" strokeWidth={2.2} />
        <Text style={styles.cooldownPillText} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
    );
  }

  if (loading) {
    // Ad is currently being shown/claimed.
    return (
      <View style={styles.loadingPill}>
        <ActivityIndicator color="#FFFFFF" size="small" />
        <Text style={styles.loadingPillText} numberOfLines={2}>
          {t.main.home.watchAdLoading}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleWatchAd}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t.main.home.watchAds}
      style={styles.imageButtonWrapper}>
      {/* Layered translucent glow behind the button graphic — the PNG's own
          inner glow gets clipped at this small size, so this adds the
          "shine" the design calls for on both platforms (shadow alone
          doesn't render a colored glow on Android). */}
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />
      <Image
        source={require('../../../../assets/reklama_btn.png')}
        style={styles.adButtonImage}
        resizeMode="contain"
      />
      {/* The graphic itself is text-free now — only the "+0,01 TWA" line
          stays baked into the PNG. This overlay is the only part of the
          button that actually changes with the app language, centered in
          the gap between the icon and the "+0,01 TWA" line. */}
      <View style={styles.adButtonTitleSlot} pointerEvents="none">
        <Text
          style={[
            styles.adButtonTitleText,
            { fontSize: titleFontSize, lineHeight: titleFontSize * 1.15 },
          ]}
          numberOfLines={2}>
          {copy.watchAdBtn}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  imageButtonWrapper: {
    width: '100%',
    aspectRatio: AD_BUTTON_IMAGE_RATIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: '112%',
    height: '150%',
    borderRadius: wp(28),
    backgroundColor: 'rgba(56, 189, 248, 0.28)',
  },
  glowInner: {
    position: 'absolute',
    width: '106%',
    height: '125%',
    borderRadius: wp(22),
    backgroundColor: 'rgba(125, 211, 252, 0.35)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  adButtonImage: {
    width: '100%',
    height: '100%',
  },
  // Fills the gap to the right of the clapperboard icon and above the
  // "+0,01 TWA" line, then vertically centers the title inside it —
  // matches where "Посмотреть рекламу" used to be baked into the graphic.
  adButtonTitleSlot: {
    position: 'absolute',
    left: '34%',
    top: '8%',
    width: '58%',
    height: '56%',
    justifyContent: 'center',
  },
  adButtonTitleText: {
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  cooldownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    width: '100%',
    minHeight: hp(56),
    backgroundColor: '#152A4D',
    borderRadius: wp(18),
    paddingHorizontal: wp(14),
    paddingVertical: hp(12),
  },
  cooldownPillText: {
    flexShrink: 1,
    fontSize: fontSize(18),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    width: '100%',
    minHeight: hp(56),
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: wp(18),
    paddingHorizontal: wp(14),
    paddingVertical: hp(12),
  },
  loadingPillText: {
    flexShrink: 1,
    fontSize: fontSize(13),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
