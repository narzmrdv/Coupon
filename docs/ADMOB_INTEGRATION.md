# 📺 Интеграция Google AdMob Rewarded Ads

## 📋 Установка

```bash
npm install @react-native-google-mobile-ads/react-native-google-mobile-ads
```

## ⚙️ Конфигурация

### Android (`android/app/src/main/AndroidManifest.xml`)

```xml
<manifest>
  <application>
    <!-- AdMob App ID -->
    <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
  </application>
</manifest>
```

### iOS (`ios/YourApp/Info.plist`)

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
```

## 🔧 Инициализация

### App.tsx

```typescript
import { useEffect } from 'react';
import mobileAds from '@react-native-google-mobile-ads/react-native-google-mobile-ads';

export default function App() {
  useEffect(() => {
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('AdMob initialized:', adapterStatuses);
      })
      .catch(error => {
        console.error('AdMob initialization error:', error);
      });
  }, []);

  return (
    // Your app content
  );
}
```

## 📺 Компонент просмотра рекламы

### src/features/ads/ui/RewardedAdButton.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds
} from 'react-native-google-mobile-ads';
import { BonusService } from '@/entities/bonus/model/bonusService';
import { BonusBalance, BonusLimits, BONUS_CONFIG } from '@/shared/types/bonus';

// Используйте тестовый ID при разработке, замените на реальный при публикации
const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY';

interface RewardedAdButtonProps {
  userId: string;
  balance: BonusBalance;
  limits: BonusLimits;
  onRewardEarned: (amount: number) => void;
  onLimitsUpdated: (newLimits: BonusLimits) => void;
}

export const RewardedAdButton: React.FC<RewardedAdButtonProps> = ({
  userId,
  balance,
  limits,
  onRewardEarned,
  onLimitsUpdated,
}) => {
  const [rewarded, setRewarded] = useState<RewardedAd | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);

  // Создание и загрузка рекламы
  useEffect(() => {
    const rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false, // Можно сделать настраиваемым
    });

    // Событие: реклама загружена
    const loadedListener = rewardedAd.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        console.log('Rewarded ad loaded');
        setIsAdReady(true);
        setIsLoading(false);
      }
    );

    // Событие: пользователь заработал награду
    const earnedListener = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async (reward) => {
        console.log('User earned reward:', reward);

        // Начислить бонусы
        const result = await BonusService.earnAdViewBonus(
          userId,
          balance,
          limits
        );

        if (result.success && result.transaction) {
          // Успешно начислено
          onRewardEarned(result.transaction.amount);

          // Обновить лимиты
          const newLimits = BonusService.updateAdViewLimits(limits);
          onLimitsUpdated(newLimits);

          Alert.alert(
            'Награда получена! 🎉',
            `Вам начислено ${result.transaction.amount} бонусов`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Ошибка', result.error || 'Не удалось начислить бонусы');
        }
      }
    );

    // Событие: ошибка загрузки
    const errorListener = rewardedAd.addAdEventListener(
      RewardedAdEventType.ERROR,
      (error) => {
        console.error('Rewarded ad error:', error);
        setIsLoading(false);
        Alert.alert('Ошибка', 'Не удалось загрузить рекламу. Попробуйте позже.');
      }
    );

    // Событие: реклама закрыта
    const closedListener = rewardedAd.addAdEventListener(
      RewardedAdEventType.CLOSED,
      () => {
        console.log('Rewarded ad closed');
        setIsAdReady(false);

        // Загрузить следующую рекламу
        setTimeout(() => {
          setIsLoading(true);
          rewardedAd.load();
        }, 1000);
      }
    );

    setRewarded(rewardedAd);
    setIsLoading(true);
    rewardedAd.load();

    // Очистка
    return () => {
      loadedListener();
      earnedListener();
      errorListener();
      closedListener();
    };
  }, [userId, balance, limits]);

  const handleWatchAd = () => {
    // Проверка лимита
    const canWatch = BonusService.canWatchAd(limits);

    if (!canWatch.allowed) {
      Alert.alert(
        'Лимит достигнут',
        canWatch.reason || 'Вы достигли дневного лимита просмотров. Попробуйте завтра!',
        [{ text: 'OK' }]
      );
      return;
    }

    // Проверка готовности рекламы
    if (!isAdReady || !rewarded) {
      Alert.alert('Загрузка', 'Реклама ещё загружается. Подождите немного.');
      return;
    }

    // Показать рекламу
    Alert.alert(
      'Просмотр рекламы',
      `Вы получите ${BONUS_CONFIG.REWARDS.AD_VIEW} бонусов за полный просмотр рекламного ролика.\n\n⚠️ Вознаграждение начисляется только за полный просмотр, а не за клики.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Смотреть',
          onPress: () => {
            rewarded.show();
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleWatchAd}
      disabled={isLoading || !isAdReady || limits.currentAdViewsToday >= limits.maxAdViewsPerDay}
      style={{
        backgroundColor:
          limits.currentAdViewsToday >= limits.maxAdViewsPerDay
            ? '#E5E7EB'
            : '#0EA5E9',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: (isLoading || !isAdReady) ? 0.6 : 1,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600', flex: 1 }}>
            {limits.currentAdViewsToday >= limits.maxAdViewsPerDay
              ? 'Лимит достигнут'
              : `Смотреть рекламу (+${BONUS_CONFIG.REWARDS.AD_VIEW} бонусов)`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
```

## 📊 Использование в экране

### src/pages/main/BalanceScreen.tsx (обновлённая версия)

```typescript
import { RewardedAdButton } from '@/features/ads/ui/RewardedAdButton';

export const BalanceScreen = () => {
  const [balance, setBalance] = useState<BonusBalance>({
    userId: 'user1',
    total: 2450,
    available: 2450,
    pending: 0,
    lastUpdated: new Date()
  });

  const [limits, setLimits] = useState<BonusLimits>({
    maxAdViewsPerDay: BONUS_CONFIG.LIMITS.MAX_AD_VIEWS_PER_DAY,
    currentAdViewsToday: 3,
    lastAdViewDate: new Date().toISOString().split('T')[0],
    maxDiscountPercent: BONUS_CONFIG.LIMITS.MAX_DISCOUNT_PERCENT,
    bonusExpirationDays: BONUS_CONFIG.LIMITS.BONUS_EXPIRATION_DAYS
  });

  const handleRewardEarned = (amount: number) => {
    // Обновить баланс
    setBalance(prev => ({
      ...prev,
      total: prev.total + amount,
      available: prev.available + amount,
      lastUpdated: new Date()
    }));

    // Сохранить в backend/storage
    // await api.updateBalance(balance.userId, amount);
  };

  const handleLimitsUpdated = (newLimits: BonusLimits) => {
    setLimits(newLimits);

    // Сохранить в backend/storage
    // await api.updateLimits(balance.userId, newLimits);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* ... остальной контент ... */}

        {/* Кнопка просмотра рекламы */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <RewardedAdButton
            userId={balance.userId}
            balance={balance}
            limits={limits}
            onRewardEarned={handleRewardEarned}
            onLimitsUpdated={handleLimitsUpdated}
          />

          {/* Информация о лимитах */}
          <View style={styles.adLimitInfo}>
            <Text style={styles.adLimitText}>
              Сегодня: {limits.currentAdViewsToday}/{limits.maxAdViewsPerDay} просмотров
            </Text>
            <View style={styles.adLimitBar}>
              <View
                style={[
                  styles.adLimitFill,
                  { width: `${(limits.currentAdViewsToday / limits.maxAdViewsPerDay) * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ... остальной контент ... */}
      </ScrollView>
    </SafeAreaView>
  );
};
```

## 🧪 Тестирование

### Тестовые ID для разработки

```typescript
import { TestIds } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED // Тестовая реклама
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY'; // Реальный ID
```

### Важно:

- ✅ При разработке используйте `TestIds.REWARDED`
- ✅ Перед публикацией замените на реальный Ad Unit ID из AdMob Console
- ⚠️ НИКОГДА не используйте тестовый ID в production!

## 📝 Получение реального Ad Unit ID

1. Войдите в [AdMob Console](https://apps.admob.com/)
2. Выберите ваше приложение (или создайте новое)
3. Создайте **Ad unit** типа **Rewarded**
4. Скопируйте **Ad unit ID** (формат: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`)
5. Замените в коде:

```typescript
const AD_UNIT_ID = Platform.select({
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/1234567890',
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/0987654321',
});
```

## ⚠️ ВАЖНЫЕ правила для соответствия Google Play

### ✅ Правильно:

```typescript
// Вознаграждение только за EARNED_REWARD
rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
  // Начислить бонусы
  awardBonus(reward.amount);
});
```

### ❌ Неправильно:

```typescript
// НЕ начисляйте за клики или загрузку!
rewardedAd.addAdEventListener(
  RewardedAdEventType.CLICKED, // ❌ ЗАПРЕЩЕНО
  () => {
    awardBonus(10); // ❌ Это нарушение политики
  }
);
```

### ✅ Всегда проверяйте лимиты:

```typescript
const canWatch = BonusService.canWatchAd(limits);
if (!canWatch.allowed) {
  // Не показывать рекламу
  showLimitMessage();
  return;
}
```

### ✅ Предупреждайте пользователя:

```typescript
Alert.alert('Просмотр рекламы', 'Вы получите бонусы за ПОЛНЫЙ просмотр ролика, а не за клики.', [
  /* ... */
]);
```

## 🔒 Защита от накрутки

### 1. Серверная валидация (рекомендуется)

```typescript
// Backend API
POST /api/bonus/validate-ad-reward
{
  userId: string,
  adUnitId: string,
  rewardAmount: number,
  timestamp: number,
  signature: string  // Подпись от AdMob SSV
}
```

### 2. Локальная защита (минимум)

```typescript
// Проверка частоты просмотров
const timeSinceLastView = Date.now() - lastViewTimestamp;
const MIN_INTERVAL = 60000; // 1 минута между просмотрами

if (timeSinceLastView < MIN_INTERVAL) {
  Alert.alert('Ошибка', 'Подождите немного перед следующим просмотром');
  return;
}
```

## 📊 Аналитика

### Отслеживание событий

```typescript
import analytics from '@react-native-firebase/analytics';

// Событие: начало просмотра
await analytics().logEvent('ad_impression', {
  ad_type: 'rewarded',
  ad_unit_id: AD_UNIT_ID,
});

// Событие: награда получена
await analytics().logEvent('ad_reward_earned', {
  ad_type: 'rewarded',
  reward_amount: 10,
  user_id: userId,
});
```

## 🐛 Отладка

### Логирование

```typescript
const rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_ID);

// Все события
Object.values(RewardedAdEventType).forEach((eventType) => {
  rewardedAd.addAdEventListener(eventType, (data) => {
    console.log(`[AdMob] ${eventType}:`, data);
  });
});
```

### Типичные ошибки

**Ошибка: "Ad failed to load"**

- Проверьте Ad Unit ID
- Убедитесь, что приложение зарегистрировано в AdMob
- Проверьте интернет-соединение

**Ошибка: "No fill"**

- Недостаточно рекламодателей
- Используйте тестовый ID при разработке
- Попробуйте позже

**Награда не начисляется:**

- Проверьте, что слушаете `EARNED_REWARD`, а не другие события
- Убедитесь, что пользователь досмотрел до конца

## 📚 Дополнительные ресурсы

- [React Native Google Mobile Ads Documentation](https://docs.page/invertase/react-native-google-mobile-ads)
- [AdMob Rewarded Ads Best Practices](https://support.google.com/admob/answer/7372450)
- [AdMob Policy Center](https://support.google.com/admob/answer/6128543)

## ✅ Чеклист перед публикацией

- [ ] Заменён тестовый Ad Unit ID на реальный
- [ ] Проверена работа на реальном устройстве
- [ ] Добавлена серверная валидация наград (рекомендуется)
- [ ] Лимиты на просмотры работают корректно
- [ ] Вознаграждение начисляется только при EARNED_REWARD
- [ ] Нет начисления за клики или загрузку рекламы
- [ ] Пользователь предупреждён о правилах

---

**Готово! 🎉 Ваша реклама с вознаграждением готова к работе.**
