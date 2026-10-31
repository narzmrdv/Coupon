# 📚 Документация бонусной системы

Эта документация объясняет, как реализована безопасная система бонусов, соответствующая политикам Google Play.

## 📋 Содержание

1. [Обзор системы](#обзор-системы)
2. [Ключевые правила](#ключевые-правила)
3. [Структура проекта](#структура-проекта)
4. [API и типы](#api-и-типы)
5. [Юридические документы](#юридические-документы)
6. [Публикация в Google Play](#публикация-в-google-play)

---

## 🎯 Обзор системы

Бонусная система разработана с учётом строгих требований Google Play:

### ✅ Что реализовано:

- **Бонусы как виртуальная награда** (НЕ деньги)
- **Чёткие лимиты** (5 просмотров рекламы в день)
- **Прозрачные правила** использования
- **Защита от накрутки** и мошенничества
- **Официальный AdMob Rewarded Ads**
- **Максимальная скидка 30%** от заказа
- **Срок действия бонусов** (365 дней)

### ❌ Чего НЕТ:

- Возможности вывода бонусов
- Обмена на реальные деньги
- Азартных механик
- Случайных наград
- Гарантий бесплатных услуг
- Обещаний заработка

---

## 🔑 Ключевые правила

### 1. Бонусы ≠ Деньги

```typescript
// Везде в коде явно указано
export const BONUS_RULES = {
  description: 'Бонусы — это виртуальная награда, НЕ деньги',
  // ...
};
```

### 2. Только скидка

```typescript
// Максимум 30% скидки
const maxDiscountPercent = 30;
const maxBonusToUse = orderAmount * (maxDiscountPercent / 100);
```

### 3. Дневные лимиты

```typescript
// Не больше 5 просмотров в день
MAX_AD_VIEWS_PER_DAY: 5;
```

### 4. Защита от накрутки

```typescript
// Проверка даты последнего просмотра
if (limits.lastAdViewDate === today && limits.currentAdViewsToday >= MAX) {
  return { allowed: false };
}
```

---

## 📁 Структура проекта

```
src/
├── shared/
│   └── types/
│       └── bonus.ts              # Типы и константы бонусной системы
├── entities/
│   └── bonus/
│       └── model/
│           └── bonusService.ts   # Бизнес-логика бонусов
└── pages/
    └── main/
        └── BalanceScreen.tsx     # UI экрана баланса с правилами

docs/
├── PRIVACY_POLICY.md            # Политика конфиденциальности
├── TERMS_OF_SERVICE.md          # Условия использования
├── GOOGLE_PLAY_SUBMISSION.md    # Инструкция по публикации
└── README.md                    # Этот файл
```

---

## 🔧 API и типы

### Основные типы

```typescript
// Баланс бонусов
interface BonusBalance {
  userId: string;
  total: number; // Общий баланс
  available: number; // Доступно к использованию
  pending: number; // В процессе
  lastUpdated: Date;
}

// Транзакция
interface BonusTransaction {
  id: string;
  userId: string;
  type: BonusTransactionType;
  amount: number; // + начисление, - списание
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  createdAt: Date;
  expiresAt?: Date; // Срок истечения
}

// Лимиты
interface BonusLimits {
  maxAdViewsPerDay: number;
  currentAdViewsToday: number;
  lastAdViewDate: string;
  maxDiscountPercent: number;
  bonusExpirationDays: number;
}
```

### Основные методы

```typescript
// Проверка возможности просмотра рекламы
BonusService.canWatchAd(limits): { allowed: boolean; reason?: string }

// Начисление за просмотр рекламы
BonusService.earnAdViewBonus(userId, balance, limits)

// Расчёт максимальной скидки
BonusService.calculateMaxDiscount(orderAmount, availableBonus)

// Применение бонусов к заказу
BonusService.applyBonusToOrder(userId, orderId, orderAmount, bonusToUse, currentBalance)
```

### Константы

```typescript
export const BONUS_CONFIG = {
  REWARDS: {
    AD_VIEW: 10, // За просмотр рекламы
    REGISTRATION: 100, // За регистрацию
    PROFILE_COMPLETE: 50, // За заполнение профиля
    REFERRAL: 200, // За реферала
  },
  LIMITS: {
    MAX_AD_VIEWS_PER_DAY: 5,
    MAX_DISCOUNT_PERCENT: 30,
    BONUS_EXPIRATION_DAYS: 365,
  },
  CONVERSION_RATE: 1, // 1 бонус = 1 скидка
  MIN_ORDER_AMOUNT_FOR_BONUS: 1000,
};
```

---

## 📄 Юридические документы

### Privacy Policy (PRIVACY_POLICY.md)

Включает:

- ✅ Определение бонусов (НЕ деньги)
- ✅ Правила начисления и использования
- ✅ Информацию о Google AdMob
- ✅ Описание собираемых данных
- ✅ Права пользователей
- ✅ Защиту от злоупотреблений

**Где использовать:**

- Ссылка в Google Play Console (обязательно!)
- Раздел в приложении
- На вашем сайте (публичный URL)

### Terms of Service (TERMS_OF_SERVICE.md)

Включает:

- ✅ Подробные правила бонусной программы
- ✅ Запрещённые действия (накрутка, фрод)
- ✅ Последствия нарушений
- ✅ Права администрации
- ✅ Соответствие Google Play Policy
- ✅ Применимое право (РФ)

**Где использовать:**

- При регистрации (галочка "Я согласен")
- Раздел в приложении
- На вашем сайте

---

## 🚀 Публикация в Google Play

### Обязательные шаги:

1. **Опубликовать Privacy Policy** на публичном URL
2. **Заполнить Data Safety** в Play Console
   - Указать сбор Advertising ID
   - Декларировать рекламу (AdMob)
3. **Правильно ответить на Content Rating**
   - Gambling: NO
   - Real Money: NO
4. **Добавить раздел "About this app"** с объяснением бонусов
5. **В описании избегать** запрещённых формулировок

### Запрещённые формулировки:

❌ "Заработай деньги"  
❌ "Получай реальные награды"  
❌ "Выиграй тур бесплатно"  
❌ "Кликай и зарабатывай"

### Правильные формулировки:

✅ "Получай бонусы за активность"  
✅ "Используй бонусы как скидку"  
✅ "Копи бонусы для выгодного бронирования"

**Подробная инструкция:** [GOOGLE_PLAY_SUBMISSION.md](./GOOGLE_PLAY_SUBMISSION.md)

---

## 🛡️ Защита от бана

### Что делает систему безопасной:

1. **Бонусы != Деньги**
   - Везде явно указано
   - Нет обмена на деньги
   - Нет вывода

2. **Никаких обещаний заработка**
   - В UI используются слова "бонусы", "скидка"
   - Нет слов "заработай", "получи деньги"

3. **Нет стимулирования кликов**
   - Используем официальный Rewarded Ads
   - Вознаграждение за просмотр, не за клик

4. **Прозрачные лимиты**
   - Видны на экране баланса
   - Нельзя обойти
   - Защита от накрутки

5. **Правильные политики**
   - Privacy Policy детально описывает систему
   - Terms of Service покрывают все случаи
   - Data Safety заполнен корректно

6. **Нет азарта**
   - Фиксированные суммы
   - Нет случайных наград
   - Нет механик "выиграл/проиграл"

7. **Бонусы = только скидка**
   - Максимум 30% заказа
   - Остаток деньгами
   - Минимальная сумма заказа

---

## 🔗 Интеграция с AdMob

### 1. Установка SDK

```bash
npm install @react-native-google-mobile-ads/react-native-google-mobile-ads
```

### 2. Инициализация

```typescript
import mobileAds from '@react-native-google-mobile-ads/react-native-google-mobile-ads';

mobileAds()
  .initialize()
  .then((adapterStatuses) => {
    // Готово
  });
```

### 3. Показ Rewarded Ad

```typescript
import { RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';

const rewarded = RewardedAd.createForAdRequest('ca-app-pub-xxxxx/xxxxx');

rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
  // Начислить бонусы
  const result = await BonusService.earnAdViewBonus(userId, balance, limits);
  if (result.success) {
    // Обновить баланс
  }
});

rewarded.load();
rewarded.show();
```

### 4. Важные моменты

- ✅ Начисляйте бонусы ТОЛЬКО при `EARNED_REWARD`
- ✅ НЕ начисляйте за клики или загрузку
- ✅ Проверяйте лимиты перед показом
- ✅ Обрабатывайте ошибки загрузки

---

## 📊 Мониторинг после запуска

### Метрики для отслеживания:

1. **Просмотры рекламы**
   - Средние просмотры на пользователя
   - Процент достижения лимита

2. **Использование бонусов**
   - Конверсия бонусов в покупки
   - Средняя сумма скидки

3. **Фродовая активность**
   - Пользователи с подозрительными паттернами
   - Множественные аккаунты с одного IP

4. **Отзывы в Play Store**
   - Вопросы о бонусах
   - Жалобы на лимиты

---

## 🆘 Если Google отклонил приложение

### Шаг 1: Прочитайте причину

Google отправляет email с конкретной причиной отклонения.

### Шаг 2: Типичные причины и решения

**"Gambling or real money prizes"**

- Ответ: Приложите скриншоты с правилами
- Объясните: "Бонусы НЕ деньги, только скидка"
- Укажите на Privacy Policy

**"Misleading content"**

- Проверьте описание на запрещённые слова
- Уберите "заработай", "получи деньги"
- Сделайте акцент на "скидка", "бонусы"

**"Insufficient privacy policy"**

- Добавьте раздел о бонусах
- Опишите Google AdMob
- Укажите все собираемые данные

### Шаг 3: Обращение в поддержку

Если не согласны с решением:

1. Нажмите "Appeal" в Play Console
2. Напишите детальное объяснение (на английском):

```
Dear Google Play Review Team,

Our app does NOT offer gambling or real money rewards.

Our bonus system:
• Bonuses are virtual loyalty points, NOT money
• Cannot be withdrawn or converted to cash
• Used ONLY as discounts (max 30%) on bookings
• This is a marketing loyalty program

We comply with all Google Play Policies:
✅ No gambling mechanics
✅ Transparent rules
✅ Fixed bonus amounts
✅ Daily limits
✅ Official AdMob Rewarded Ads

Privacy Policy: [URL]
Terms of Service: [URL]

Please review again. Thank you!
```

---

## 📞 Поддержка

Если есть вопросы по реализации:

1. Проверьте [FAQ](#часто-задаваемые-вопросы) ниже
2. Изучите код в `/src/entities/bonus/`
3. Прочитайте Google Play Policies

---

## ❓ Часто задаваемые вопросы

### Q: Можно ли увеличить лимит просмотров рекламы?

A: Технически да, но не рекомендуется превышать 10 просмотров в день. Google может посчитать это злоупотреблением. 5-7 просмотров — оптимально.

### Q: Можно ли давать 100% скидку бонусами?

A: **НЕТ!** Это нарушает политику Google. Максимум 30-50% скидки. Остальное должно оплачиваться реальными деньгами.

### Q: Можно ли добавить "лутбоксы" или случайные награды?

A: **НЕТ!** Любые случайные механики с наградами = азартные игры = бан. Только фиксированные суммы.

### Q: Нужно ли платить налоги с бонусов?

A: Если бонусы — виртуальная награда без денежного эквивалента, налоги не применяются. Но проконсультируйтесь с юристом.

### Q: Можно ли использовать другие рекламные сети кроме AdMob?

A: Да, но убедитесь, что они официально поддерживают Rewarded Ads и соответствуют политикам Google Play.

---

## ✅ Итоговый чеклист

Перед публикацией убедитесь:

- [ ] Везде написано "бонусы НЕ деньги"
- [ ] Максимальная скидка 30%
- [ ] Лимиты на просмотры рекламы работают
- [ ] Privacy Policy опубликована
- [ ] Terms of Service опубликованы
- [ ] Data Safety заполнен
- [ ] Ads declaration: YES
- [ ] Content Rating: No Gambling
- [ ] Описание не содержит "заработай деньги"
- [ ] В UI есть правила бонусов
- [ ] AdMob интегрирован правильно

---

**Удачи с публикацией! 🚀**

Если следовать этой документации, ваше приложение пройдёт модерацию Google Play без проблем.
