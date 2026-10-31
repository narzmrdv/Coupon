import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Gift,
  Plane,
  Ticket,
  ShoppingBag,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Copy,
} from 'lucide-react-native';
import { useLanguage, useBonus } from '@/shared/lib/hooks';
import { useNavigation } from '@react-navigation/native';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { BonusShopPurchase, BonusShopPurchaseStatus } from '@/shared/types/bonus';

type Language = 'ru' | 'en' | 'uk';

// Парсинг локализованного текста из JSON строки
const getLocalizedText = (jsonString: string, lang: Language): string => {
  try {
    const obj = JSON.parse(jsonString);
    return obj[lang] || obj.en || obj.ru || jsonString;
  } catch {
    return jsonString;
  }
};

// Форматирование даты
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Иконки для статусов
const STATUS_ICONS: Record<BonusShopPurchaseStatus, typeof CheckCircle> = {
  PENDING: Clock,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  REFUNDED: RotateCcw,
};

// Цвета для статусов
const STATUS_COLORS: Record<BonusShopPurchaseStatus, string> = {
  PENDING: '#F59E0B',
  COMPLETED: '#10B981',
  CANCELLED: '#EF4444',
  REFUNDED: '#6366F1',
};

// Иконки для типов товаров
const TYPE_ICONS: Record<string, typeof Plane> = {
  TOUR_DISCOUNT: Plane,
  DISCOUNT_COUPON: Ticket,
  GIFT: Gift,
  OTHER: ShoppingBag,
};

export const MyPurchasesScreen = () => {
  const { t, currentLang } = useLanguage();
  const navigation = useNavigation();
  const { myPurchases, fetchMyPurchases, loading } = useBonus();

  useEffect(() => {
    fetchMyPurchases();
  }, [fetchMyPurchases]);

  const copyCode = useCallback((code: string) => {
    try {
      Clipboard.setString(code);
      Alert.alert(t.common.success, t.bonusShop.codeCopied || 'Code copied to clipboard');
    } catch {
      // Fallback: показать код в Alert для ручного копирования
      Alert.alert(t.bonusShop.purchaseCode || 'Code', code);
    }
  }, [t]);

  const getStatusText = (status: BonusShopPurchaseStatus): string => {
    const statusTexts: Record<BonusShopPurchaseStatus, string> = {
      PENDING: t.bonusShop.status?.PENDING || 'Pending',
      COMPLETED: t.bonusShop.status?.COMPLETED || 'Completed',
      CANCELLED: t.bonusShop.status?.CANCELLED || 'Cancelled',
      REFUNDED: t.bonusShop.status?.REFUNDED || 'Refunded',
    };
    return statusTexts[status];
  };

  if (loading && myPurchases.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AirplaneBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.bonusShop.myPurchases || 'My Purchases'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Purchases List */}
        <View style={styles.purchasesList}>
          {myPurchases.map((purchase) => {
            const itemName = getLocalizedText(purchase.item.name, currentLang as Language);
            const itemDescription = getLocalizedText(purchase.item.description, currentLang as Language);
            const StatusIcon = STATUS_ICONS[purchase.status];
            const statusColor = STATUS_COLORS[purchase.status];
            const ItemIcon = TYPE_ICONS[purchase.item.type] || Gift;
            const useGiftEmoji =
              purchase.item.type === 'SERVICE' ||
              purchase.item.type === 'GIFT' ||
              purchase.item.type === 'OTHER' ||
              purchase.item.type === 'TOUR_DISCOUNT';

            return (
              <View key={purchase.id} style={styles.purchaseCard}>
                <View style={styles.purchaseHeader}>
                  <View style={styles.purchaseIconContainer}>
                    {useGiftEmoji ? (
                      <Text style={styles.giftEmoji}>🎁</Text>
                    ) : (
                      <ItemIcon size={24} color="#F59E0B" />
                    )}
                  </View>
                  <View style={styles.purchaseInfo}>
                    <Text style={styles.purchaseName}>{itemName}</Text>
                    <Text style={styles.purchaseDescription} numberOfLines={1}>
                      {itemDescription}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <StatusIcon size={14} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusText(purchase.status)}
                    </Text>
                  </View>
                </View>

                {/* Purchase Code */}
                {purchase.code && (
                  <TouchableOpacity
                    style={styles.codeContainer}
                    onPress={() => copyCode(purchase.code!)}>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeLabel}>{t.bonusShop.purchaseCode || 'Code'}:</Text>
                      <Text style={styles.codeText}>{purchase.code}</Text>
                    </View>
                    <Copy size={18} color="#64748B" />
                  </TouchableOpacity>
                )}

                {/* Purchase Details */}
                <View style={styles.purchaseDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.bonusShop.bonusPaid || 'Paid'}:</Text>
                    <View style={styles.bonusBadge}>
                      <Plane size={12} color="#FFD700" />
                      <Text style={styles.bonusText}>{purchase.bonusPaid}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.bonusShop.purchaseDate || 'Date'}:</Text>
                    <Text style={styles.detailValue}>{formatDate(purchase.createdAt)}</Text>
                  </View>

                  {purchase.expiresAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t.bonusShop.validUntil || 'Valid until'}:</Text>
                      <Text style={styles.detailValue}>{formatDate(purchase.expiresAt)}</Text>
                    </View>
                  )}

                  {purchase.usedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t.bonusShop.usedAt || 'Used'}:</Text>
                      <Text style={styles.detailValue}>{formatDate(purchase.usedAt)}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {myPurchases.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Gift size={64} color="#94A3B8" />
              <Text style={styles.emptyStateTitle}>
                {t.bonusShop.noPurchases || 'No purchases yet'}
              </Text>
              <Text style={styles.emptyStateText}>
                {t.bonusShop.noPurchasesHint || 'Your purchases will appear here'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  purchasesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  purchaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  purchaseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  giftEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  purchaseDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 1,
  },
  purchaseDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bonusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
