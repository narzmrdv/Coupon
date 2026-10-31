import { apiClient } from '@/shared/lib/api/apiClient';
import { API_CONFIG } from '@/shared/config/api';
import {
  BonusBalance,
  BonusLimits,
  BonusTransaction,
  BonusShopItem,
  BonusShopPurchase,
  PurchaseResponse,
  AdViewRequest,
  AdRewardResponse,
  CanWatchAdResponse,
  TransactionsResponse,
} from '@/shared/types/bonus';

export interface MaxDiscountResponse {
  maxDiscount: number;
  maxBonusToUse: number;
  reason: string;
}

export interface ApplyBonusDto {
  orderId: string;
  orderAmount: number;
  bonusToUse: number;
}

export interface EarnReferralDto {
  referralName?: string;
}

export interface UploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

class BonusApi {
  /**
   * Получить баланс бонусов.
   * Бэкенд иногда сериализует числовые поля (NUMERIC в Postgres) как строки —
   * приводим к number здесь, чтобы .toFixed()/сравнения не падали ни у одного
   * потребителя (BonusShop, Jackpot, MysteryBox и т.д.).
   */
  async getBalance(): Promise<BonusBalance> {
    const data = await apiClient.get<BonusBalance>(API_CONFIG.ENDPOINTS.BONUS.BALANCE);
    return {
      ...data,
      total: Number(data.total) || 0,
      available: Number(data.available) || 0,
      pending: Number(data.pending) || 0,
    };
  }

  /**
   * Получить лимиты пользователя
   */
  async getLimits(): Promise<BonusLimits> {
    return apiClient.get<BonusLimits>(API_CONFIG.ENDPOINTS.BONUS.LIMITS);
  }

  /**
   * Проверить возможность просмотра рекламы. Сервер — источник истины по
   * паузам (view_pause / block_pause / daily_limit); coerce на случай если
   * numeric-поля снова придут строками, как это уже бывало с балансом.
   */
  async canWatchAd(): Promise<CanWatchAdResponse> {
    const data = await apiClient.get<CanWatchAdResponse>(API_CONFIG.ENDPOINTS.BONUS.CAN_WATCH_AD);
    return {
      canWatch: !!data.canWatch,
      viewsToday: Number(data.viewsToday) || 0,
      limit: Number(data.limit) || 0,
      nextAvailableInSec: Number(data.nextAvailableInSec) || 0,
      reason: data.reason ?? null,
    };
  }

  /**
   * Начислить бонусы за просмотр рекламы (Legacy - без SSV)
   */
  async earnAdViewBonus(): Promise<BonusTransaction> {
    return apiClient.post<BonusTransaction>(API_CONFIG.ENDPOINTS.BONUS.EARN_AD_VIEW);
  }

  // ========== SSV Ad Methods ==========

  /**
   * SSV Шаг 1: Запросить просмотр рекламы
   * Возвращает adViewId и customData для передачи в рекламный SDK
   */
  async requestAdView(adNetwork?: string): Promise<AdViewRequest> {
    const timezoneOffsetMinutes = -new Date().getTimezoneOffset();
    return apiClient.post<AdViewRequest>(API_CONFIG.ENDPOINTS.BONUS.AD_REQUEST, {
      adNetwork,
      timezoneOffsetMinutes,
    });
  }

  /**
   * SSV Шаг 3 (Fallback): Запросить награду вручную
   * Используется если SSV callback не сработал
   */
  async rewardAdView(adViewId: string): Promise<AdRewardResponse> {
    return apiClient.post<AdRewardResponse>(`${API_CONFIG.ENDPOINTS.BONUS.AD_REWARD}/${adViewId}`);
  }

  /**
   * Начислить бонусы за регистрацию
   */
  async earnRegistrationBonus(): Promise<BonusTransaction> {
    return apiClient.post<BonusTransaction>(API_CONFIG.ENDPOINTS.BONUS.EARN_REGISTRATION);
  }

  /**
   * Начислить бонусы за заполнение профиля
   */
  async earnProfileCompleteBonus(): Promise<BonusTransaction> {
    return apiClient.post<BonusTransaction>(API_CONFIG.ENDPOINTS.BONUS.EARN_PROFILE_COMPLETE);
  }

  /**
   * Начислить бонусы за реферала
   */
  async earnReferralBonus(dto?: EarnReferralDto): Promise<BonusTransaction> {
    return apiClient.post<BonusTransaction>(API_CONFIG.ENDPOINTS.BONUS.EARN_REFERRAL, dto);
  }

  /**
   * Применить бонусы к заказу
   */
  async applyBonusToOrder(dto: ApplyBonusDto): Promise<BonusTransaction> {
    return apiClient.post<BonusTransaction>(API_CONFIG.ENDPOINTS.BONUS.APPLY, dto);
  }

  /**
   * Получить историю транзакций
   */
  async getTransactions(
    limit: number = 50,
    offset: number = 0,
    type?: string
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (type) {
      params.append('type', type);
    }
    return apiClient.get<TransactionsResponse>(
      `${API_CONFIG.ENDPOINTS.BONUS.TRANSACTIONS}?${params.toString()}`
    );
  }

  /**
   * Рассчитать максимальную скидку для заказа
   */
  async calculateMaxDiscount(orderAmount: number): Promise<MaxDiscountResponse> {
    return apiClient.post<MaxDiscountResponse>(
      API_CONFIG.ENDPOINTS.BONUS.CALCULATE_MAX_DISCOUNT,
      { orderAmount }
    );
  }

  /**
   * Загрузить файл
   */
  async uploadFile(
    file: any,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    return apiClient.uploadFile<UploadResponse>(
      API_CONFIG.ENDPOINTS.BONUS.UPLOAD,
      file,
      onProgress
    );
  }

  // ========== Bonus Shop Methods ==========

  /**
   * Получить товары магазина
   */
  async getShopItems(): Promise<BonusShopItem[]> {
    return apiClient.get<BonusShopItem[]>(API_CONFIG.ENDPOINTS.BONUS_SHOP.ITEMS);
  }

  /**
   * Получить товар по ID
   */
  async getShopItemById(id: number): Promise<BonusShopItem> {
    return apiClient.get<BonusShopItem>(`${API_CONFIG.ENDPOINTS.BONUS_SHOP.ITEMS}/${id}`);
  }

  /**
   * Купить товар за бонусы
   */
  async purchaseItem(itemId: number): Promise<PurchaseResponse> {
    return apiClient.post<PurchaseResponse>(API_CONFIG.ENDPOINTS.BONUS_SHOP.PURCHASE, { itemId });
  }

  /** Применить награду из каталога TWA: списание баланса + промокод. */
  async redeemCatalogReward(catalogId: string): Promise<PurchaseResponse> {
    return apiClient.post<PurchaseResponse>(API_CONFIG.ENDPOINTS.BONUS_SHOP.REDEEM_CATALOG, {
      catalogId,
    });
  }

  /**
   * Получить мои покупки
   */
  async getMyPurchases(): Promise<BonusShopPurchase[]> {
    return apiClient.get<BonusShopPurchase[]>(API_CONFIG.ENDPOINTS.BONUS_SHOP.MY_PURCHASES);
  }
}

export const bonusApi = new BonusApi();
