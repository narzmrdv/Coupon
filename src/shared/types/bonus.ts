/**
 * Типы бонусной системы
 * ВАЖНО: Бонусы не являются деньгами и не имеют денежного эквивалента
 */

export type BonusTransactionType =
  | 'EARNED_AD_VIEW' // За просмотр рекламы
  | 'EARNED_REGISTRATION' // За регистрацию
  | 'EARNED_PROFILE_COMPLETE' // За заполнение профиля
  | 'EARNED_REFERRAL' // За приглашение друга
  | 'SPENT_DISCOUNT' // Использовано как скидка
  | 'SPENT_SHOP_PURCHASE' // Покупка в магазине бонусов
  | 'EXPIRED' // Истёк срок действия
  | 'ADJUSTMENT'; // Корректировка администратором

export interface BonusTransaction {
  id: string;
  userId: string;
  type: BonusTransactionType;
  amount: number; // Положительное для начисления, отрицательное для списания
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string; // Если использовано для заказа
  createdAt: Date;
  expiresAt?: Date; // Срок действия бонусов
}

export interface BonusBalance {
  userId: string;
  total: number; // Общий баланс
  available: number; // Доступно к использованию (не истекшие)
  pending: number; // В процессе использования
  lastUpdated: Date;
}

export interface BonusLimits {
  maxAdViewsPerDay: number;
  currentAdViewsToday: number;
  lastAdViewDate: string;
  maxDiscountPercent: number;
  bonusExpirationDays: number;
  lastBatchCompletedAt?: string | null;
  adsPerBatch?: number;
  batchesPerDay?: number;
  batchRemaining?: number;
  batchCooldownUntil?: string | null;
  nextPeriodResetAt?: string | null;
  rewardPerView?: number;
  viewsPerTwa?: number;
  viewsTowardOneTwa?: number;
  progressToOneTwa?: number;
}

export interface BonusReward {
  type: BonusTransactionType;
  amount: number;
  description: string;
}

/**
 * Константы бонусной системы
 */
export const BONUS_CONFIG = {
  REWARDS: {
    AD_VIEW: 0.01,
    REGISTRATION: 100,
    PROFILE_COMPLETE: 50,
    REFERRAL: 200,
  },

  LIMITS: {
    MAX_AD_VIEWS_PER_DAY: 25,
    ADS_PER_BATCH: 5,
    BATCHES_PER_DAY: 5,
    BATCH_COOLDOWN_MINUTES: 30,
    VIEWS_PER_TWA: 100,
    MAX_DISCOUNT_PERCENT: 30, // Максимум 30% скидки
    BONUS_EXPIRATION_DAYS: 365, // Бонусы действуют 1 год
  },

  // Конвертация бонусов
  CONVERSION_RATE: 1,

  // Минимальная сумма для использования бонусов
  MIN_ORDER_AMOUNT_FOR_BONUS: 1000, // Минимум 1000 для заказа
} as const;

/**
 * Правила использования бонусов (для отображения пользователю)
 */
// Bonus Shop Types
export type BonusShopItemType =
  | 'DISCOUNT_COUPON'
  | 'GIFT'
  | 'SERVICE'
  | 'TOUR_DISCOUNT'
  | 'OTHER';

export type BonusShopPurchaseStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface BonusShopItem {
  id: number;
  name: string;        // JSON: {"ru": "...", "en": "...", "uk": "..."}
  description: string; // JSON: {"ru": "...", "en": "...", "uk": "..."}
  chatMessage?: string; // JSON: {"ru": "...", "en": "...", "uk": "..."}
  location?: string;   // JSON или plain string
  duration?: string;   // JSON или plain string
  type: BonusShopItemType;
  price: number;
  originalValue?: number;
  discountPercent?: number;
  imageUrl?: string;
  sortOrder?: number;
  stock?: number;
  maxPerUser?: number;
  validDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BonusShopPurchase {
  id: string;
  userId: number;
  itemId: number;
  bonusPaid: number;
  status: BonusShopPurchaseStatus;
  code?: string;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  item: Pick<BonusShopItem, 'name' | 'description' | 'type' | 'imageUrl'>;
}

export interface PurchaseResponse {
  success: boolean;
  purchase: BonusShopPurchase;
  item: {
    name: string;
    type: string;
  };
  code: string;
  expiresAt?: string;
  newBalance: number;
}

// ==================== SSV РЕКЛАМА ====================

export type AdViewStatus =
  | 'PENDING' // Ожидает просмотра
  | 'VERIFIED' // Подтверждено
  | 'REWARDED' // Бонусы начислены
  | 'EXPIRED' // Истекло
  | 'FAILED'; // Ошибка

export interface AdViewRequest {
  adViewId: string;
  rewardAmount: number;
  expiresAt: string;
  customData: string; // Base64 для передачи в SDK
}

export interface AdRewardResponse {
  success: boolean;
  transaction?: BonusTransaction;
  newBalance?: number;
  rewardAmount?: number;
  error?: string;
  /** Present when the request failed with 429 — the pause hasn't elapsed
   *  yet. Start a countdown from this instead of treating it as a plain error. */
  nextAvailableInSec?: number;
  reason?: AdWatchPauseReason;
}

/** `view_pause` — 2 min between ads within a batch of 5.
 *  `block_pause` — 30 min between batches.
 *  `daily_limit` — the 25-views-per-day cap is reached. */
export type AdWatchPauseReason = 'view_pause' | 'block_pause' | 'daily_limit';

/** The server is the sole source of truth for ad-view pacing — it tracks
 *  pauses itself now, so this is polled on screen focus / app foreground
 *  and the returned `nextAvailableInSec` drives a local display-only
 *  countdown (never the other way around). */
export interface CanWatchAdResponse {
  canWatch: boolean;
  viewsToday: number;
  limit: number;
  nextAvailableInSec: number;
  reason: AdWatchPauseReason | null;
}

export interface TransactionsResponse {
  transactions: BonusTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export const BONUS_RULES = {
  title: 'Как работает бонусная система',
  description: 'Бонусы — это виртуальная награда за активность в приложении',

  rules: [
    {
      title: 'Что такое бонусы',
      items: [
        'Бонусы — это виртуальная награда, НЕ деньги',
        'Бонусы не имеют денежного эквивалента',
        'Нельзя обменять на реальные деньги',
        'Нельзя вывести со счёта',
        'Используются ТОЛЬКО как скидка внутри приложения',
      ],
    },
    {
      title: 'Как получить бонусы',
      items: [
        `${BONUS_CONFIG.REWARDS.REGISTRATION} бонусов — при регистрации`,
        `${BONUS_CONFIG.REWARDS.PROFILE_COMPLETE} бонусов — за заполнение профиля`,
        `${BONUS_CONFIG.REWARDS.AD_VIEW} бонусов — за просмотр рекламного ролика (до ${BONUS_CONFIG.LIMITS.MAX_AD_VIEWS_PER_DAY} раз в день)`,
        `${BONUS_CONFIG.REWARDS.REFERRAL} бонусов — за приглашенного друга`,
      ],
    },
    {
      title: 'Как использовать бонусы',
      items: [
        '1 бонус = 1 скидка на бронирование тура',
        `Можно оплатить максимум ${BONUS_CONFIG.LIMITS.MAX_DISCOUNT_PERCENT}% стоимости тура`,
        `Минимальная сумма заказа — ${BONUS_CONFIG.MIN_ORDER_AMOUNT_FOR_BONUS}`,
        'Остальную часть нужно оплатить реальными деньгами',
        'Бонусы применяются автоматически при оформлении заказа',
      ],
    },
    {
      title: 'Ограничения',
      items: [
        `Максимум ${BONUS_CONFIG.LIMITS.MAX_AD_VIEWS_PER_DAY} просмотров рекламы в день`,
        `Срок действия бонусов — ${BONUS_CONFIG.LIMITS.BONUS_EXPIRATION_DAYS} дней`,
        'Истекшие бонусы автоматически списываются',
        'Бонусы нельзя передать другому пользователю',
      ],
    },
    {
      title: 'Важные замечания',
      items: [
        '⚠️ Бонусы не гарантируют бесплатное получение товаров или услуг',
        '⚠️ Это маркетинговая программа лояльности, а не способ заработка',
        '⚠️ Администрация может изменить условия программы',
        '⚠️ Запрещена накрутка и мошенничество — аккаунт будет заблокирован',
      ],
    },
  ],

  disclaimer:
    'Просмотр рекламы вознаграждается только за полный просмотр ролика, а не за клики по рекламе. Мы используем официальные рекламные SDK (Google AdMob Rewarded Ads), одобренные Google Play.',
} as const;
