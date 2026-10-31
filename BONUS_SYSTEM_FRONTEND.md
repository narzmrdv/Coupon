# Bonus System - Frontend Implementation Guide

## Содержание
1. [API Endpoints](#api-endpoints)
2. [Типы данных](#типы-данных)
3. [Просмотр рекламы (SSV)](#просмотр-рекламы-ssv)
4. [Магазин бонусов](#магазин-бонусов)
5. [Реализация на фронте](#реализация-на-фронте)

---

## API Endpoints

### Бонусы пользователя

| Endpoint | Method | Auth | Описание |
|----------|--------|------|----------|
| `/bonus/balance` | GET | JWT | Баланс пользователя |
| `/bonus/limits` | GET | JWT | Лимиты (макс рекламы в день и тд) |
| `/bonus/transactions` | GET | JWT | История транзакций |
| `/bonus/can-watch-ad` | GET | JWT | Можно ли смотреть рекламу |
| `/bonus/calculate-max-discount` | POST | JWT | Макс скидка для заказа |
| `/bonus/apply` | POST | JWT | Применить бонусы к заказу |

### Заработок бонусов

| Endpoint | Method | Auth | Описание |
|----------|--------|------|----------|
| `/bonus/ad/request` | POST | JWT | **SSV Шаг 1:** Запросить просмотр рекламы |
| `/bonus/ad/callback` | GET/POST | НЕТ | **SSV Шаг 2:** Callback от рекламной сети |
| `/bonus/ad/reward/:adViewId` | POST | JWT | **SSV Шаг 3:** Запросить награду вручную |
| `/bonus/earn/ad-view` | POST | JWT | Legacy: начислить без SSV |
| `/bonus/earn/registration` | POST | JWT | Бонус за регистрацию |
| `/bonus/earn/profile-complete` | POST | JWT | Бонус за заполнение профиля |
| `/bonus/earn/referral` | POST | JWT | Бонус за реферала |

### Магазин бонусов

| Endpoint | Method | Auth | Описание |
|----------|--------|------|----------|
| `/bonus-shop/items` | GET | JWT | Все активные товары |
| `/bonus-shop/items/:id` | GET | JWT | Товар по ID |
| `/bonus-shop/purchase` | POST | JWT | Купить товар |
| `/bonus-shop/my-purchases` | GET | JWT | Мои покупки |
| `/bonus-shop/settings` | GET | JWT | Настройки системы |

---

## Типы данных

```typescript
// src/shared/types/bonus.ts

// ==================== БАЛАНС И ЛИМИТЫ ====================

export interface BonusBalance {
  userId: number;
  total: number;        // Общий баланс
  available: number;    // Доступный (не истекший)
  pending: number;
  lastUpdated: string;
}

export interface BonusLimits {
  maxAdViewsPerDay: number;
  currentAdViewsToday: number;
  lastAdViewDate: string;
  maxDiscountPercent: number;
  bonusExpirationDays: number;
}

export interface CanWatchAdResponse {
  allowed: boolean;
  reason: string | null;
  remaining: number;
}

// ==================== ТРАНЗАКЦИИ ====================

export type BonusTransactionType =
  | 'EARNED_AD_VIEW'
  | 'EARNED_REGISTRATION'
  | 'EARNED_PROFILE_COMPLETE'
  | 'EARNED_REFERRAL'
  | 'SPENT_DISCOUNT'
  | 'SPENT_SHOP_PURCHASE'
  | 'EXPIRED'
  | 'ADJUSTMENT';

export interface BonusTransaction {
  id: string;
  userId: number;
  type: BonusTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface TransactionsResponse {
  transactions: BonusTransaction[];
  total: number;
  limit: number;
  offset: number;
}

// ==================== РЕКЛАМА (SSV) ====================

export type AdViewStatus =
  | 'PENDING'    // Ожидает просмотра
  | 'VERIFIED'   // Подтверждено
  | 'REWARDED'   // Бонусы начислены
  | 'EXPIRED'    // Истекло
  | 'FAILED';    // Ошибка

export interface AdViewRequest {
  adViewId: string;
  rewardAmount: number;
  expiresAt: string;
  customData: string;  // Base64 для передачи в SDK
}

export interface AdRewardResponse {
  success: boolean;
  transaction?: BonusTransaction;
  newBalance?: number;
  rewardAmount?: number;
  error?: string;
}

// ==================== МАГАЗИН ====================

export type BonusShopItemType =
  | 'DISCOUNT_COUPON'
  | 'GIFT'
  | 'SERVICE'
  | 'TOUR_DISCOUNT'
  | 'OTHER';

export interface BonusShopItem {
  id: number;
  name: string;           // JSON: {"ru": "...", "en": "...", "uk": "..."}
  description: string;    // JSON локализация
  type: BonusShopItemType;
  price: number;          // Цена в бонусах
  originalValue?: number; // Реальная стоимость
  discountPercent?: number;
  imageUrl?: string;
  location?: string;      // Локация тура
  duration?: string;      // Длительность
  stock?: number;         // null = безлимитно
  maxPerUser?: number;
  validDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BonusShopPurchaseStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface BonusShopPurchase {
  id: string;
  userId: number;
  itemId: number;
  bonusPaid: number;
  status: BonusShopPurchaseStatus;
  code?: string;          // Промокод
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  item: {
    name: string;
    description: string;
    type: string;
    imageUrl?: string;
  };
}

export interface PurchaseResponse {
  success: boolean;
  purchase: BonusShopPurchase;
  item: { name: string; type: string };
  code: string;
  expiresAt?: string;
  newBalance: number;
}
```

---

## Просмотр рекламы (SSV)

### Флоу с Server-Side Verification

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SSV Flow                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Фронт                    2. Показ рекламы                        │
│     │                            │                                   │
│     ▼                            ▼                                   │
│  POST /bonus/ad/request    SDK показывает рекламу                   │
│     │                       с customData                             │
│     ▼                            │                                   │
│  { adViewId, customData }        │                                   │
│                                  │                                   │
│                                  ▼                                   │
│                         3. Рекламная сеть                           │
│                            отправляет callback                       │
│                                  │                                   │
│                                  ▼                                   │
│                         GET /bonus/ad/callback                       │
│                         (серверы AdMob/Unity)                        │
│                                  │                                   │
│                                  ▼                                   │
│                         4. Бэкенд автоматически                      │
│                            начисляет бонусы                          │
│                                                                      │
│  5. (Fallback) Если callback не пришел:                             │
│     POST /bonus/ad/reward/:adViewId                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Реализация на фронте

```typescript
// src/entities/bonus/api/bonusApi.ts

import { api } from '@/shared/api';

export const bonusApi = {
  // ... другие методы

  /**
   * SSV Шаг 1: Запросить просмотр рекламы
   */
  async requestAdView(adNetwork?: string): Promise<AdViewRequest> {
    const response = await api.post('/bonus/ad/request', { adNetwork });
    return response.data;
  },

  /**
   * SSV Шаг 3 (Fallback): Запросить награду вручную
   */
  async rewardAdView(adViewId: string): Promise<AdRewardResponse> {
    const response = await api.post(`/bonus/ad/reward/${adViewId}`);
    return response.data;
  },

  /**
   * Legacy: Начислить без SSV (для тестирования)
   */
  async earnAdViewBonusLegacy(): Promise<BonusTransaction> {
    const response = await api.post('/bonus/earn/ad-view');
    return response.data;
  },
};
```

### Пример использования с React Native AdMob

```typescript
// src/features/watch-ad/ui/WatchAdButton.tsx

import { useState } from 'react';
import { RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { bonusApi } from '@/entities/bonus';
import { useBonus } from '@/shared/lib/hooks';

const adUnitId = 'ca-app-pub-xxxxx/yyyyy'; // Твой Ad Unit ID

export const WatchAdButton = () => {
  const [loading, setLoading] = useState(false);
  const [currentAdViewId, setCurrentAdViewId] = useState<string | null>(null);
  const { fetchBalance, checkCanWatchAd } = useBonus();

  const handleWatchAd = async () => {
    try {
      setLoading(true);

      // Проверить можно ли смотреть
      const canWatch = await bonusApi.canWatchAd();
      if (!canWatch.allowed) {
        Alert.alert('Лимит', canWatch.reason || 'Попробуйте завтра');
        return;
      }

      // SSV Шаг 1: Запросить adViewId
      const adRequest = await bonusApi.requestAdView('admob');
      setCurrentAdViewId(adRequest.adViewId);

      // Загрузить и показать рекламу
      const rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        serverSideVerificationOptions: {
          customData: adRequest.customData, // ← Передаем customData!
        },
      });

      rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewardedAd.show();
      });

      rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
        // Награда будет начислена автоматически через SSV callback
        // Но на всякий случай обновим баланс
        setTimeout(() => {
          fetchBalance();
        }, 2000);
      });

      rewardedAd.addAdEventListener('closed', async () => {
        // Если SSV callback не сработал, пробуем вручную
        if (currentAdViewId) {
          try {
            await bonusApi.rewardAdView(currentAdViewId);
          } catch (e) {
            // Возможно уже начислено через SSV
          }
          fetchBalance();
        }
        setCurrentAdViewId(null);
      });

      rewardedAd.load();

    } catch (error) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity onPress={handleWatchAd} disabled={loading}>
      <Text>{loading ? 'Загрузка...' : 'Смотреть рекламу'}</Text>
    </TouchableOpacity>
  );
};
```

### Пример использования с Expo Ads (упрощенный)

```typescript
// src/features/watch-ad/model/useWatchAd.ts

import { useState, useCallback } from 'react';
import { AdMobRewarded } from 'expo-ads-admob';
import { bonusApi } from '@/entities/bonus';

export const useWatchAd = () => {
  const [loading, setLoading] = useState(false);
  const [adViewId, setAdViewId] = useState<string | null>(null);

  const watchAd = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Запросить adViewId
      const { adViewId: id, customData } = await bonusApi.requestAdView('admob');
      setAdViewId(id);

      // 2. Настроить SSV
      await AdMobRewarded.setAdUnitID('ca-app-pub-xxx/yyy');
      // Примечание: expo-ads-admob не поддерживает customData напрямую
      // Для полного SSV используй react-native-google-mobile-ads

      // 3. Показать рекламу
      await AdMobRewarded.requestAdAsync();
      await AdMobRewarded.showAdAsync();

      // 4. После просмотра - запросить награду
      const result = await bonusApi.rewardAdView(id);
      return result;

    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
      setAdViewId(null);
    }
  }, []);

  return { watchAd, loading };
};
```

---

## Магазин бонусов

### API методы

```typescript
// src/entities/bonus/api/bonusApi.ts

export const bonusApi = {
  // ... существующие методы

  // Магазин
  async getShopItems(): Promise<BonusShopItem[]> {
    const response = await api.get('/bonus-shop/items');
    return response.data;
  },

  async getShopItemById(id: number): Promise<BonusShopItem> {
    const response = await api.get(`/bonus-shop/items/${id}`);
    return response.data;
  },

  async purchaseItem(itemId: number): Promise<PurchaseResponse> {
    const response = await api.post('/bonus-shop/purchase', { itemId });
    return response.data;
  },

  async getMyPurchases(): Promise<BonusShopPurchase[]> {
    const response = await api.get('/bonus-shop/my-purchases');
    return response.data;
  },
};
```

### Парсинг локализации

```typescript
// src/shared/lib/utils/localization.ts

type Lang = 'ru' | 'en' | 'uk';

export const getLocalizedText = (
  jsonString: string,
  lang: Lang,
  fallback: Lang = 'en'
): string => {
  try {
    const obj = JSON.parse(jsonString);
    return obj[lang] || obj[fallback] || obj.ru || jsonString;
  } catch {
    return jsonString;
  }
};

// Использование:
const itemName = getLocalizedText(item.name, currentLang);
const itemDescription = getLocalizedText(item.description, currentLang);
```

### Обновленный useBonus хук

```typescript
// src/shared/lib/hooks/useBonus.ts

import { useState, useEffect, useCallback } from 'react';
import { bonusApi } from '@/entities/bonus';
import type {
  BonusBalance,
  BonusLimits,
  BonusTransaction,
  BonusShopItem,
  BonusShopPurchase,
  AdViewRequest,
} from '@/shared/types/bonus';

export const useBonus = () => {
  const [balance, setBalance] = useState<BonusBalance | null>(null);
  const [limits, setLimits] = useState<BonusLimits | null>(null);
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [shopItems, setShopItems] = useState<BonusShopItem[]>([]);
  const [myPurchases, setMyPurchases] = useState<BonusShopPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Баланс
  const fetchBalance = useCallback(async () => {
    try {
      const data = await bonusApi.getBalance();
      setBalance(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Лимиты
  const fetchLimits = useCallback(async () => {
    try {
      const data = await bonusApi.getLimits();
      setLimits(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Проверка возможности смотреть рекламу
  const checkCanWatchAd = useCallback(async () => {
    try {
      return await bonusApi.canWatchAd();
    } catch {
      return { allowed: false, reason: 'Error', remaining: 0 };
    }
  }, []);

  // SSV: Запросить просмотр рекламы
  const requestAdView = useCallback(async (adNetwork?: string) => {
    try {
      setLoading(true);
      return await bonusApi.requestAdView(adNetwork);
    } finally {
      setLoading(false);
    }
  }, []);

  // SSV: Получить награду
  const claimAdReward = useCallback(async (adViewId: string) => {
    try {
      setLoading(true);
      const result = await bonusApi.rewardAdView(adViewId);
      if (result.success) {
        await fetchBalance();
        await fetchLimits();
      }
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, fetchLimits]);

  // Товары магазина
  const fetchShopItems = useCallback(async () => {
    try {
      const items = await bonusApi.getShopItems();
      setShopItems(items);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Мои покупки
  const fetchMyPurchases = useCallback(async () => {
    try {
      const purchases = await bonusApi.getMyPurchases();
      setMyPurchases(purchases);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Купить товар
  const purchaseShopItem = useCallback(async (itemId: number) => {
    try {
      setLoading(true);
      const result = await bonusApi.purchaseItem(itemId);
      await fetchBalance();
      await fetchMyPurchases();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, fetchMyPurchases]);

  // Инициализация
  useEffect(() => {
    fetchBalance();
    fetchLimits();
  }, []);

  return {
    // Данные
    balance,
    limits,
    transactions,
    shopItems,
    myPurchases,
    loading,
    error,

    // Методы
    fetchBalance,
    fetchLimits,
    checkCanWatchAd,
    requestAdView,
    claimAdReward,
    fetchShopItems,
    fetchMyPurchases,
    purchaseShopItem,
  };
};
```

---

## Реализация на фронте

### Структура файлов

```
src/
├── shared/
│   ├── types/
│   │   └── bonus.ts              # Все типы
│   ├── config/
│   │   └── api.ts                # Endpoints
│   └── lib/
│       ├── hooks/
│       │   └── useBonus.ts       # Хук бонусов
│       └── utils/
│           └── localization.ts   # Парсинг JSON локализации
│
├── entities/
│   └── bonus/
│       ├── api/
│       │   └── bonusApi.ts       # API методы
│       └── index.ts
│
├── features/
│   ├── watch-ad/
│   │   ├── ui/
│   │   │   └── WatchAdButton.tsx
│   │   └── model/
│   │       └── useWatchAd.ts
│   │
│   └── purchase-item/
│       └── ui/
│           └── PurchaseButton.tsx
│
└── pages/
    └── main/
        ├── BonusShopScreen.tsx   # Магазин
        ├── MyPurchasesScreen.tsx # Мои покупки
        └── BalanceScreen.tsx     # Баланс и история
```

### Добавить endpoints

```typescript
// src/shared/config/api.ts

export const API_ENDPOINTS = {
  // ... существующие

  BONUS: {
    BALANCE: '/bonus/balance',
    LIMITS: '/bonus/limits',
    CAN_WATCH_AD: '/bonus/can-watch-ad',
    TRANSACTIONS: '/bonus/transactions',
    AD_REQUEST: '/bonus/ad/request',
    AD_REWARD: '/bonus/ad/reward',
    EARN_AD_VIEW: '/bonus/earn/ad-view',
    EARN_REGISTRATION: '/bonus/earn/registration',
    EARN_PROFILE_COMPLETE: '/bonus/earn/profile-complete',
    EARN_REFERRAL: '/bonus/earn/referral',
    APPLY: '/bonus/apply',
    CALCULATE_MAX_DISCOUNT: '/bonus/calculate-max-discount',
  },

  BONUS_SHOP: {
    ITEMS: '/bonus-shop/items',
    PURCHASE: '/bonus-shop/purchase',
    MY_PURCHASES: '/bonus-shop/my-purchases',
    SETTINGS: '/bonus-shop/settings',
  },
};
```

### Добавить переводы

```typescript
// locales/ru.ts
export default {
  bonus: {
    balance: 'Баланс',
    available: 'Доступно',
    history: 'История',
    watchAd: 'Смотреть рекламу',
    watchAdReward: 'Получите {amount} бонусов',
    dailyLimit: 'Дневной лимит',
    adsRemaining: 'Осталось просмотров: {count}',
    limitReached: 'Лимит исчерпан',
    tryTomorrow: 'Попробуйте завтра',

    transactionTypes: {
      EARNED_AD_VIEW: 'Просмотр рекламы',
      EARNED_REGISTRATION: 'Бонус за регистрацию',
      EARNED_PROFILE_COMPLETE: 'Заполнение профиля',
      EARNED_REFERRAL: 'Приглашение друга',
      SPENT_DISCOUNT: 'Скидка на заказ',
      SPENT_SHOP_PURCHASE: 'Покупка в магазине',
      EXPIRED: 'Срок истек',
      ADJUSTMENT: 'Корректировка',
    },
  },

  bonusShop: {
    title: 'Магазин бонусов',
    myPurchases: 'Мои покупки',
    buy: 'Купить',
    price: '{price} бонусов',
    originalPrice: 'Стоимость: {price}',
    location: 'Локация',
    duration: 'Длительность',
    outOfStock: 'Нет в наличии',
    limitReached: 'Достигнут лимит',
    notEnoughBonuses: 'Недостаточно бонусов',
    needMore: 'Нужно еще {amount}',

    purchaseCode: 'Код',
    validUntil: 'Действителен до',
    usedAt: 'Использован',

    status: {
      PENDING: 'Ожидает',
      COMPLETED: 'Активен',
      CANCELLED: 'Отменен',
      REFUNDED: 'Возвращен',
    },
  },
};
```

---

## Чеклист реализации

### Обязательно
- [ ] Типы в `shared/types/bonus.ts`
- [ ] Endpoints в `shared/config/api.ts`
- [ ] API методы в `entities/bonus/api/bonusApi.ts`
- [ ] Обновить `useBonus` хук
- [ ] Обновить `BonusShopScreen` - убрать хардкод товаров
- [ ] Создать `MyPurchasesScreen`
- [ ] Добавить роут в навигацию
- [ ] Переводы ru/en/uk
- [ ] Парсинг JSON локализации

### SSV Реклама
- [ ] Установить `react-native-google-mobile-ads`
- [ ] Настроить Ad Unit ID
- [ ] Реализовать `WatchAdButton` с SSV
- [ ] Передавать `customData` в SDK
- [ ] Fallback через `rewardAdView`

### Опционально
- [ ] Кэширование баланса
- [ ] Pull-to-refresh на экранах
- [ ] Скелетоны при загрузке
- [ ] Анимация начисления бонусов
