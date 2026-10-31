/**
 * Сервис управления бонусами
 * Реализует безопасную систему с лимитами и защитой от накрутки
 */

import {
  BonusBalance,
  BonusTransaction,
  BonusTransactionType,
  BonusLimits,
  BONUS_CONFIG,
} from '@/shared/types/bonus';

export class BonusService {
  /**
   * Проверка дневного лимита на просмотр рекламы
   */
  static canWatchAd(limits: BonusLimits): { allowed: boolean; reason?: string } {
    if (limits.currentAdViewsToday >= limits.maxAdViewsPerDay) {
      return {
        allowed: false,
        reason: `Достигнут дневной лимит просмотров (${limits.maxAdViewsPerDay} в день)`,
      };
    }
    return { allowed: true };
  }

  /**
   * Начисление бонусов за просмотр рекламы
   */
  static async earnAdViewBonus(
    userId: string,
    currentBalance: BonusBalance,
    limits: BonusLimits
  ): Promise<{ success: boolean; transaction?: BonusTransaction; error?: string }> {
    // Проверка лимита
    const canWatch = this.canWatchAd(limits);
    if (!canWatch.allowed) {
      return { success: false, error: canWatch.reason };
    }

    // Создание транзакции
    const amount = BONUS_CONFIG.REWARDS.AD_VIEW;
    const transaction: BonusTransaction = {
      id: this.generateId(),
      userId,
      type: 'EARNED_AD_VIEW',
      amount,
      balanceBefore: currentBalance.total,
      balanceAfter: currentBalance.total + amount,
      description: 'Награда за просмотр рекламного ролика',
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
    };

    return { success: true, transaction };
  }

  /**
   * Начисление бонусов за регистрацию
   */
  static createRegistrationBonus(userId: string): BonusTransaction {
    const amount = BONUS_CONFIG.REWARDS.REGISTRATION;
    return {
      id: this.generateId(),
      userId,
      type: 'EARNED_REGISTRATION',
      amount,
      balanceBefore: 0,
      balanceAfter: amount,
      description: 'Приветственный бонус за регистрацию',
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
    };
  }

  /**
   * Начисление бонусов за заполнение профиля
   */
  static createProfileCompleteBonus(userId: string, currentBalance: number): BonusTransaction {
    const amount = BONUS_CONFIG.REWARDS.PROFILE_COMPLETE;
    return {
      id: this.generateId(),
      userId,
      type: 'EARNED_PROFILE_COMPLETE',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      description: 'Бонус за полное заполнение профиля',
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
    };
  }

  /**
   * Начисление бонусов за реферала
   */
  static createReferralBonus(
    userId: string,
    currentBalance: number,
    referralName?: string
  ): BonusTransaction {
    const amount = BONUS_CONFIG.REWARDS.REFERRAL;
    return {
      id: this.generateId(),
      userId,
      type: 'EARNED_REFERRAL',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      description: referralName
        ? `Бонус за приглашение ${referralName}`
        : 'Бонус за приглашение друга',
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
    };
  }

  /**
   * Расчёт максимальной скидки для заказа
   */
  static calculateMaxDiscount(
    orderAmount: number,
    availableBonus: number
  ): { maxDiscount: number; maxBonusToUse: number; reason: string } {
    // Проверка минимальной суммы заказа
    if (orderAmount < BONUS_CONFIG.MIN_ORDER_AMOUNT_FOR_BONUS) {
      return {
        maxDiscount: 0,
        maxBonusToUse: 0,
        reason: `Минимальная сумма заказа для использования бонусов — ${BONUS_CONFIG.MIN_ORDER_AMOUNT_FOR_BONUS}`,
      };
    }

    // Максимальная скидка = 30% от суммы заказа
    const maxDiscountAmount = orderAmount * (BONUS_CONFIG.LIMITS.MAX_DISCOUNT_PERCENT / 100);

    // Сколько бонусов можем использовать
    const maxBonusToUse = Math.min(maxDiscountAmount, availableBonus);

    return {
      maxDiscount: maxBonusToUse,
      maxBonusToUse: Math.floor(maxBonusToUse),
      reason: `Можно использовать до ${BONUS_CONFIG.LIMITS.MAX_DISCOUNT_PERCENT}% от суммы заказа`,
    };
  }

  /**
   * Применение бонусов к заказу
   */
  static applyBonusToOrder(
    userId: string,
    orderId: string,
    orderAmount: number,
    bonusToUse: number,
    currentBalance: number
  ): { success: boolean; transaction?: BonusTransaction; error?: string } {
    // Проверка баланса
    if (bonusToUse > currentBalance) {
      return {
        success: false,
        error: 'Недостаточно бонусов на счёте',
      };
    }

    // Проверка лимита скидки
    const maxDiscount = this.calculateMaxDiscount(orderAmount, currentBalance);
    if (bonusToUse > maxDiscount.maxBonusToUse) {
      return {
        success: false,
        error: `Максимальная скидка для этого заказа — ${maxDiscount.maxBonusToUse}`,
      };
    }

    // Создание транзакции списания
    const transaction: BonusTransaction = {
      id: this.generateId(),
      userId,
      type: 'SPENT_DISCOUNT',
      amount: -bonusToUse,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance - bonusToUse,
      description: `Скидка на заказ №${orderId}`,
      orderId,
      createdAt: new Date(),
    };

    return { success: true, transaction };
  }

  /**
   * Удаление истёкших бонусов
   */
  static expireBonuses(
    userId: string,
    expiredAmount: number,
    currentBalance: number
  ): BonusTransaction {
    return {
      id: this.generateId(),
      userId,
      type: 'EXPIRED',
      amount: -expiredAmount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance - expiredAmount,
      description: 'Истёк срок действия бонусов',
      createdAt: new Date(),
    };
  }

  /**
   * Обновление счётчика просмотров рекламы
   */
  static updateAdViewLimits(limits: BonusLimits): BonusLimits {
    const today = new Date().toISOString().split('T')[0];

    // Если новый день — сбросить счётчик
    if (limits.lastAdViewDate !== today) {
      return {
        ...limits,
        currentAdViewsToday: 1,
        lastAdViewDate: today,
      };
    }

    // Увеличить счётчик
    return {
      ...limits,
      currentAdViewsToday: limits.currentAdViewsToday + 1,
    };
  }

  /**
   * Инициализация лимитов для нового пользователя
   */
  static initializeLimits(): BonusLimits {
    return {
      maxAdViewsPerDay: BONUS_CONFIG.LIMITS.MAX_AD_VIEWS_PER_DAY,
      currentAdViewsToday: 0,
      lastAdViewDate: new Date().toISOString().split('T')[0],
      maxDiscountPercent: BONUS_CONFIG.LIMITS.MAX_DISCOUNT_PERCENT,
      bonusExpirationDays: BONUS_CONFIG.LIMITS.BONUS_EXPIRATION_DAYS,
    };
  }

  /**
   * Расчёт срока истечения бонусов
   */
  private static calculateExpirationDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + BONUS_CONFIG.LIMITS.BONUS_EXPIRATION_DAYS);
    return date;
  }

  /**
   * Генерация уникального ID
   */
  private static generateId(): string {
    return `bonus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Форматирование суммы бонусов для отображения
   */
  static formatBonus(amount: number): string {
    return `${amount.toLocaleString('ru-RU')} бонусов`;
  }

  /**
   * Форматирование описания транзакции
   */
  static getTransactionTitle(type: BonusTransactionType): string {
    const titles: Record<BonusTransactionType, string> = {
      EARNED_AD_VIEW: '📺 Просмотр рекламы',
      EARNED_REGISTRATION: '🎉 Приветственный бонус',
      EARNED_PROFILE_COMPLETE: '✅ Профиль заполнен',
      EARNED_REFERRAL: '👥 Приглашён друг',
      SPENT_DISCOUNT: '🎫 Использовано как скидка',
      SPENT_SHOP_PURCHASE: '🛍 Покупка в магазине',
      EXPIRED: '⏰ Срок истёк',
      ADJUSTMENT: '⚙️ Корректировка',
    };
    return titles[type] || 'Операция';
  }
}
