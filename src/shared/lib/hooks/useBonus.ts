import { useState, useEffect, useCallback } from 'react';
import { bonusApi } from '@/entities/bonus';
import {
  BonusBalance,
  BonusLimits,
  BonusTransaction,
  BonusShopItem,
  BonusShopPurchase,
  AdViewRequest,
  AdRewardResponse,
  CanWatchAdResponse,
} from '@/shared/types/bonus';

export const useBonus = () => {
  const [balance, setBalance] = useState<BonusBalance | null>(null);
  const [limits, setLimits] = useState<BonusLimits | null>(null);
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [shopItems, setShopItems] = useState<BonusShopItem[]>([]);
  const [myPurchases, setMyPurchases] = useState<BonusShopPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузить баланс
  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bonusApi.getBalance();
      setBalance(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load balance');
      if (__DEV__) console.error('Failed to load balance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузить лимиты
  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bonusApi.getLimits();
      setLimits(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load limits');
      if (__DEV__) console.error('Failed to load limits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузить транзакции
  const fetchTransactions = useCallback(async (limit = 50, offset = 0) => {
    try {
      setLoading(true);
      const data = await bonusApi.getTransactions(limit, offset);
      setTransactions(data.transactions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
      if (__DEV__) console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Проверить возможность просмотра рекламы. Сервер — единственный источник
  // истины по паузам; при сбое запроса возвращаем null (а не выдуманное
  // "заблокировано"), чтобы транзитная сетевая ошибка не морозила кнопку —
  // реальную паузу всё равно поймает 429 на попытке начисления.
  const checkCanWatchAd = useCallback(async (): Promise<CanWatchAdResponse | null> => {
    try {
      return await bonusApi.canWatchAd();
    } catch (err: any) {
      if (__DEV__) console.error('Failed to check ad availability:', err);
      return null;
    }
  }, []);

  // Начислить бонусы за просмотр рекламы (Legacy - без SSV)
  const earnAdViewBonus = useCallback(async (): Promise<AdRewardResponse & { success: boolean; transaction?: BonusTransaction }> => {
    try {
      setLoading(true);
      const transaction = await bonusApi.earnAdViewBonus();
      await fetchBalance();
      await fetchLimits();
      setError(null);
      return { success: true, transaction };
    } catch (err: any) {
      setError(err.message || 'Failed to earn bonus');
      if (__DEV__) console.error('Failed to earn ad view bonus:', err);
      return {
        success: false,
        error: err.message,
        // 429 — пауза ещё не вышла, а не обычная ошибка.
        nextAvailableInSec: err.statusCode === 429 ? err.nextAvailableInSec : undefined,
        reason: err.statusCode === 429 ? err.reason : undefined,
      };
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, fetchLimits]);

  // ========== SSV Ad Methods ==========

  // SSV Шаг 1: Запросить просмотр рекламы
  const requestAdView = useCallback(async (adNetwork?: string): Promise<AdViewRequest | null> => {
    try {
      setLoading(true);
      const result = await bonusApi.requestAdView(adNetwork);
      setError(null);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to request ad view');
      if (__DEV__) console.error('Failed to request ad view:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // SSV Шаг 3 (Fallback): Получить награду за просмотр рекламы
  const claimAdReward = useCallback(
    async (adViewId: string): Promise<AdRewardResponse> => {
      try {
        setLoading(true);
        const result = await bonusApi.rewardAdView(adViewId);
        if (result.success) {
          await fetchBalance();
          await fetchLimits();
        }
        setError(null);
        return result;
      } catch (err: any) {
        setError(err.message || 'Failed to claim ad reward');
        if (__DEV__) console.error('Failed to claim ad reward:', err);
        return {
          success: false,
          error: err.message,
          nextAvailableInSec: err.statusCode === 429 ? err.nextAvailableInSec : undefined,
          reason: err.statusCode === 429 ? err.reason : undefined,
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance, fetchLimits]
  );

  // Начислить бонусы за регистрацию
  const earnRegistrationBonus = useCallback(async () => {
    try {
      const transaction = await bonusApi.earnRegistrationBonus();
      await fetchBalance();
      return { success: true, transaction };
    } catch (err: any) {
      if (__DEV__) console.error('Failed to earn registration bonus:', err);
      return { success: false, error: err.message };
    }
  }, [fetchBalance]);

  // Начислить бонусы за заполнение профиля
  const earnProfileCompleteBonus = useCallback(async () => {
    try {
      const transaction = await bonusApi.earnProfileCompleteBonus();
      await fetchBalance();
      return { success: true, transaction };
    } catch (err: any) {
      if (__DEV__) console.error('Failed to earn profile complete bonus:', err);
      return { success: false, error: err.message };
    }
  }, [fetchBalance]);

  // Начислить бонусы за реферала
  const earnReferralBonus = useCallback(
    async (referralName?: string) => {
      try {
        const transaction = await bonusApi.earnReferralBonus(
          referralName ? { referralName } : undefined
        );
        await fetchBalance();
        return { success: true, transaction };
      } catch (err: any) {
        if (__DEV__) console.error('Failed to earn referral bonus:', err);
        return { success: false, error: err.message };
      }
    },
    [fetchBalance]
  );

  // Применить бонусы к заказу
  const applyBonusToOrder = useCallback(
    async (orderId: string, orderAmount: number, bonusToUse: number) => {
      try {
        setLoading(true);
        const transaction = await bonusApi.applyBonusToOrder({
          orderId,
          orderAmount,
          bonusToUse,
        });
        await fetchBalance();
        setError(null);
        return { success: true, transaction };
      } catch (err: any) {
        setError(err.message || 'Failed to apply bonus');
        if (__DEV__) console.error('Failed to apply bonus to order:', err);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance]
  );

  // Рассчитать максимальную скидку
  const calculateMaxDiscount = useCallback(async (orderAmount: number) => {
    try {
      return await bonusApi.calculateMaxDiscount(orderAmount);
    } catch (err: any) {
      if (__DEV__) console.error('Failed to calculate max discount:', err);
      return { maxDiscount: 0, maxBonusToUse: 0, reason: 'Failed to calculate' };
    }
  }, []);

  // Загрузить файл
  const uploadFile = useCallback(
    async (file: any, onProgress?: (progress: number) => void) => {
      try {
        setLoading(true);
        const result = await bonusApi.uploadFile(file, onProgress);
        setError(null);
        return { success: true, data: result };
      } catch (err: any) {
        setError(err.message || 'Failed to upload file');
        if (__DEV__) console.error('Failed to upload file:', err);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ========== Bonus Shop Methods ==========

  // Загрузить товары магазина
  const fetchShopItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await bonusApi.getShopItems();
      setShopItems(items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load shop items');
      if (__DEV__) console.error('Failed to load shop items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузить мои покупки
  const fetchMyPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const purchases = await bonusApi.getMyPurchases();
      setMyPurchases(purchases);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchases');
      if (__DEV__) console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Купить товар в магазине
  const redeemCatalogReward = useCallback(
    async (catalogId: string) => {
      try {
        setLoading(true);
        const result = await bonusApi.redeemCatalogReward(catalogId);
        await fetchBalance();
        await fetchMyPurchases();
        setError(null);
        return { success: true, data: result };
      } catch (err: any) {
        setError(err.message || 'Failed to redeem reward');
        if (__DEV__) console.error('Failed to redeem catalog reward:', err);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance, fetchMyPurchases],
  );

  const purchaseShopItem = useCallback(
    async (itemId: number) => {
      try {
        setLoading(true);
        const result = await bonusApi.purchaseItem(itemId);
        await fetchBalance();
        await fetchMyPurchases();
        setError(null);
        return { success: true, data: result };
      } catch (err: any) {
        const message = err.requestUrl ? `${err.message} (${err.requestUrl})` : err.message;
        setError(message || 'Failed to purchase item');
        if (__DEV__) console.error('Failed to purchase item:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance, fetchMyPurchases]
  );

  // Загрузить данные при монтировании
  useEffect(() => {
    fetchBalance();
    fetchLimits();
    fetchTransactions();
  }, [fetchBalance, fetchLimits, fetchTransactions]);

  return {
    // State
    balance,
    limits,
    transactions,
    shopItems,
    myPurchases,
    loading,
    error,
    // Fetch methods
    fetchBalance,
    fetchLimits,
    fetchTransactions,
    // Ad methods
    checkCanWatchAd,
    earnAdViewBonus,
    requestAdView,
    claimAdReward,
    // Earn methods
    earnRegistrationBonus,
    earnProfileCompleteBonus,
    earnReferralBonus,
    // Order methods
    applyBonusToOrder,
    calculateMaxDiscount,
    // Upload
    uploadFile,
    // Shop methods
    fetchShopItems,
    fetchMyPurchases,
    redeemCatalogReward,
    purchaseShopItem,
  };
};
