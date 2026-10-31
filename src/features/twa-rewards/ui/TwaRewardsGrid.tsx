import React, { useState, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Gift, MapPin, Clock, X, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/MainStack';
import { useLanguage } from '@/shared/lib/hooks';
import { useBonus } from '@/shared/lib/hooks/useBonus';
import { useBonusShopCatalog, type DynamicRewardItem } from '@/shared/lib/hooks/useBonusShopCatalog';
import { wp, hp, fontSize } from '@/shared/lib/responsive';
import { getCashDue, getOnlineDeposit } from '@/features/twa-rewards/lib/bonusShopPricing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAP = wp(10);
const OUTER_PADDING = wp(16);
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - OUTER_PADDING * 2 - GAP) / 2);
// A numeric maxHeight (not a '85%' string) so Android's Yoga layout reliably
// bounds the sheet — percentage maxHeight combined with flexShrink on the
// inner ScrollView is known to be unreliable on Android, which is why the
// description wasn't actually scrolling.
const SHEET_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.85);

const LABELS: Record<string, {
  notEnough: string; buy: string; close: string; confirm: string;
  confirmTitle: string; cancel: string; errorTitle: string; details: string;
}> = {
  ru: { notEnough: 'Мало бонусов', buy: 'Получить', close: 'Закрыть',
        confirm: 'Применить', confirmTitle: 'Применить награду?',
        cancel: 'Отмена', errorTitle: 'Ошибка', details: 'Подробнее' },
  en: { notEnough: 'Not enough', buy: 'Get reward', close: 'Close',
        confirm: 'Apply', confirmTitle: 'Apply reward?',
        cancel: 'Cancel', errorTitle: 'Error', details: 'Details' },
  uk: { notEnough: 'Мало бонусів', buy: 'Отримати', close: 'Закрити',
        confirm: 'Застосувати', confirmTitle: 'Застосувати нагороду?',
        cancel: 'Скасувати', errorTitle: 'Помилка', details: 'Детальніше' },
};

type RewardItem = DynamicRewardItem;

type Props = {
  balance: number;
  showTitle?: boolean;
  onBalanceChange?: () => void;
};

export const TwaRewardsGrid: React.FC<Props> = ({ balance: balanceProp, showTitle = true, onBalanceChange }) => {
  // Backend sometimes serializes the balance as a numeric string (e.g. Postgres
  // NUMERIC columns) — coerce so `.toFixed()`/comparisons below never break.
  const balance = Number(balanceProp) || 0;
  const { t, language } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { purchaseShopItem } = useBonus();
  const { fetchCatalog, getItems, loading: catalogLoading } = useBonusShopCatalog();

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const L = LABELS[language] ?? LABELS.ru;

  useEffect(() => {
    void fetchCatalog(language);
  }, [language, fetchCatalog]);

  // Strip the "api-" prefix we add in useBonusShopCatalog to get the real
  // numeric backend item id. `/bonus-shop/redeem-catalog` doesn't exist on
  // the backend (undocumented, always 404s) — the real, documented endpoint
  // is POST /bonus-shop/purchase { itemId: number }.
  const getRealId = (itemId: string): number | null => {
    if (!itemId.startsWith('api-')) return null;
    const numericId = Number(itemId.slice(4));
    return Number.isFinite(numericId) ? numericId : null;
  };

  const doRedeem = async (item: RewardItem) => {
    if (applyingId !== null) return; // guard against double-tap while a request is in flight
    const itemId = getRealId(item.id);
    if (itemId === null) {
      Alert.alert(L.errorTitle, t.bonusShop.applyFailed);
      return;
    }
    setApplyingId(item.id);
    try {
      const result = await purchaseShopItem(itemId);
      if (!result.success || !result.data?.code) {
        // Modals are already closed by this point in the flow below, so a
        // silent `setError` here would never be seen — surface it directly.
        const message = result.error || t.bonusShop.applyFailed;
        setConfirmVisible(false);
        Alert.alert(L.errorTitle, message);
        return;
      }
      const code = result.data.code;
      const cashDue = getCashDue(item.price);
      const chatMessage = cashDue > 0
        ? `${item.chatMessage}\n\n${t.bonusShop.purchaseCode}: ${code}\n${t.bonusShop.cashDueChatNote.replace('{amount}', `${cashDue} USD`)}`
        : `${item.chatMessage}\n\n${t.bonusShop.purchaseCode}: ${code}`;
      setConfirmVisible(false);
      setSelectedItem(null);
      onBalanceChange?.();
      navigation.navigate('MainTabs', {
        screen: 'Chat',
        params: { draftMessage: chatMessage },
      });
    } catch (e: any) {
      setConfirmVisible(false);
      Alert.alert(L.errorTitle, e?.message ?? 'Unknown error');
    } finally {
      setApplyingId(null);
    }
  };

  const handleCardPress = (item: RewardItem) => {
    setSelectedItem(item);
  };

  const handleBuyPress = () => {
    if (!selectedItem) return;
    if (balance < getOnlineDeposit(selectedItem.price)) return;
    setConfirmVisible(true);
  };

  let catalogItems: RewardItem[] = [];
  try {
    catalogItems = getItems(language);
  } catch (e) {
    if (__DEV__) console.error('[TwaRewardsGrid] getItems threw:', e);
  }
  const canAffordSelected = selectedItem ? balance >= getOnlineDeposit(selectedItem.price) : false;

  if (catalogLoading && catalogItems.length === 0) {
    return (
      <View style={styles.loaderWrapper}>
        <ActivityIndicator color="#0EA5E9" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {showTitle ? (
        <Text style={styles.sectionTitle}>{t.bonusShop.availableRewards}</Text>
      ) : null}

      {/* ── Grid ── */}
      <View style={styles.grid}>
        {catalogItems.map((item) => {
          const deposit = getOnlineDeposit(item.price);
          const canAfford = balance >= deposit;
          const isApplying = applyingId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => handleCardPress(item)}>

              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceBadgeText}>{item.price} TWA</Text>
                </View>
                {!canAfford && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{L.notEnough}</Text>
                  </View>
                )}
              </View>

              {/* Icon */}
              <View style={styles.iconWrapper}>
                {isApplying
                  ? <ActivityIndicator size="small" color="#0EA5E9" />
                  : <Gift size={wp(36)} color="#0EA5E9" strokeWidth={1.8} />}
              </View>

              {/* Title */}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title || item.description}
              </Text>

              {/* Desc (truncated — full text in modal) */}
              {!!item.description && item.title !== item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* Meta */}
              {!!item.location && (
                <View style={styles.metaRow}>
                  <MapPin size={11} color="#94A3B8" strokeWidth={2} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
                </View>
              )}
              {!!item.duration && (
                <View style={styles.metaRow}>
                  <Clock size={11} color="#94A3B8" strokeWidth={2} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.duration}</Text>
                </View>
              )}

              {/* Tap hint */}
              <View style={styles.detailsHint}>
                <Text style={styles.detailsHintText}>{L.details}</Text>
                <ChevronRight size={wp(12)} color="#0EA5E9" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Detail modal ── */}
      {/* visible also requires !confirmVisible: two RN <Modal> visible at once
          crashes on Android, so the confirm modal must fully replace this one */}
      <Modal
        visible={selectedItem !== null && !confirmVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.overlay}>
          {/* Full-screen backdrop — tap it to dismiss. A separate element
              (not a Pressable wrapping the content) so it never competes
              with the ScrollView below for the touch responder; the sheet
              simply paints on top and physically covers it, which is all
              "tap outside to close" needs. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedItem(null)} />
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedItem(null)}>
              <X size={wp(20)} color="#64748B" strokeWidth={2.5} />
            </TouchableOpacity>

            <ScrollView
              // Remount on item change so old scroll offset doesn't carry
              // over to the next item's (often shorter) description — that's
              // what made scroll "work once, then stop" on later opens.
              key={selectedItem?.id ?? 'none'}
              style={styles.sheetScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}>
              {/* Price badge */}
              <View style={styles.modalPriceBadge}>
                <Text style={styles.modalPriceText}>{selectedItem?.price} TWA</Text>
              </View>

              {/* Icon */}
              <View style={styles.modalIconWrapper}>
                <Gift size={wp(52)} color="#0EA5E9" strokeWidth={1.5} />
              </View>

              {/* Title */}
              <Text style={styles.modalTitle}>
                {selectedItem?.title || selectedItem?.description}
              </Text>

              {/* Full description */}
              {!!selectedItem?.description && selectedItem.title !== selectedItem.description && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.modalDesc}>{selectedItem.description}</Text>
                </>
              )}

              {/* Price breakdown: online deposit vs. cash due on pickup */}
              {!!selectedItem && (
                <View style={styles.priceBreakdown}>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>{t.bonusShop.totalPriceLabel}</Text>
                    <Text style={styles.priceBreakdownValue}>{selectedItem.price} TWA</Text>
                  </View>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>{t.bonusShop.onlineDepositLabel}</Text>
                    <Text style={[styles.priceBreakdownValue, styles.priceBreakdownDeposit]}>
                      {getOnlineDeposit(selectedItem.price)} TWA
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>{t.bonusShop.cashDueLabel}</Text>
                    <Text style={styles.priceBreakdownValue}>{getCashDue(selectedItem.price)} USD</Text>
                  </View>
                  <Text style={styles.priceBreakdownNote}>
                    {t.bonusShop.cashDueNote
                      .replace('{deposit}', `${getOnlineDeposit(selectedItem.price)} TWA`)
                      .replace('{cash}', `${getCashDue(selectedItem.price)} USD`)}
                  </Text>
                </View>
              )}

              {/* Meta */}
              {(!!selectedItem?.location || !!selectedItem?.duration) && (
                <View style={styles.modalMeta}>
                  {!!selectedItem?.location && (
                    <View style={styles.modalMetaRow}>
                      <MapPin size={wp(16)} color="#0EA5E9" strokeWidth={2} />
                      <Text style={styles.modalMetaText}>{selectedItem.location}</Text>
                    </View>
                  )}
                  {!!selectedItem?.duration && (
                    <View style={styles.modalMetaRow}>
                      <Clock size={wp(16)} color="#0EA5E9" strokeWidth={2} />
                      <Text style={styles.modalMetaText}>{selectedItem.duration}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Balance info */}
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceInfoLabel}>Ваш баланс:</Text>
                <Text style={[styles.balanceInfoValue,
                  !canAffordSelected && styles.balanceInfoInsufficient]}>
                  {balance.toFixed(2)} TWA
                </Text>
              </View>

            </ScrollView>

            {/* Buy button */}
            <View style={styles.sheetFooter}>
              {applyingId === selectedItem?.id ? (
                <View style={styles.buyBtn}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : canAffordSelected ? (
                <TouchableOpacity style={styles.buyBtn} activeOpacity={0.85} onPress={handleBuyPress}>
                  <Text style={styles.buyBtnText}>{L.buy}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.buyBtn, styles.buyBtnDisabled]}>
                  <Text style={styles.buyBtnTextDisabled}>{L.notEnough}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Confirm modal ── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{L.confirmTitle}</Text>
            <Text style={styles.confirmDesc}>
              {selectedItem?.title}{'\n'}
              <Text style={styles.confirmPrice}>
                {selectedItem ? getOnlineDeposit(selectedItem.price) : 0} TWA
              </Text>
            </Text>
            {!!selectedItem && getCashDue(selectedItem.price) > 0 && (
              <Text style={styles.confirmCashNote}>
                {t.bonusShop.cashDueNote
                  .replace('{deposit}', `${getOnlineDeposit(selectedItem.price)} TWA`)
                  .replace('{cash}', `${getCashDue(selectedItem.price)} USD`)}
              </Text>
            )}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                disabled={applyingId !== null}
                onPress={() => setConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>{L.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmOkBtn, applyingId !== null && styles.buyBtnDisabled]}
                disabled={applyingId !== null}
                onPress={() => selectedItem && doRedeem(selectedItem)}>
                {applyingId !== null ? (
                  <ActivityIndicator size="small" color="#0EA5E9" />
                ) : (
                  <Text style={styles.confirmOkText}>{L.confirm}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: fontSize(20), fontWeight: '700', color: '#1E293B', marginBottom: hp(14),
  },
  loaderWrapper: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  // ── Card ──
  card: {
    width: CARD_WIDTH, backgroundColor: '#FFFFFF',
    borderRadius: wp(16), padding: wp(12),
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: hp(10), flexWrap: 'wrap', gap: 4,
  },
  priceBadge: {
    backgroundColor: '#0EA5E9', paddingHorizontal: wp(10),
    paddingVertical: hp(4), borderRadius: wp(20),
  },
  priceBadgeText: { fontSize: fontSize(12), fontWeight: '700', color: '#FFFFFF' },
  statusBadge: {
    backgroundColor: '#F1F5F9', paddingHorizontal: wp(8),
    paddingVertical: hp(4), borderRadius: wp(20),
  },
  statusBadgeText: { fontSize: fontSize(10), fontWeight: '600', color: '#64748B' },
  iconWrapper: {
    width: wp(64), height: wp(64), borderRadius: wp(32),
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: hp(10),
  },
  cardTitle: {
    fontSize: fontSize(14), fontWeight: '700', color: '#1E293B',
    marginBottom: hp(4), textAlign: 'center',
  },
  cardDesc: {
    fontSize: fontSize(12), color: '#64748B',
    lineHeight: fontSize(17), marginBottom: hp(6), textAlign: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: wp(4), marginBottom: hp(3) },
  metaText: { fontSize: fontSize(11), color: '#94A3B8', flex: 1 },
  detailsHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: wp(3), marginTop: hp(8),
  },
  detailsHintText: { fontSize: fontSize(12), color: '#0EA5E9', fontWeight: '600' },

  // ── Detail sheet ──
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: wp(24), borderTopRightRadius: wp(24),
    maxHeight: SHEET_MAX_HEIGHT, paddingTop: hp(12),
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  sheetHandle: {
    width: wp(40), height: hp(4), backgroundColor: '#E2E8F0',
    borderRadius: 2, alignSelf: 'center', marginBottom: hp(12),
  },
  closeBtn: {
    position: 'absolute', top: hp(16), right: wp(16), zIndex: 10,
    width: wp(36), height: wp(36), borderRadius: wp(18),
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  // flexShrink (not flex) lets the sheet stay compact for short descriptions
  // but shrink — and scroll internally — instead of overflowing the sheet's
  // maxHeight when the description is long.
  sheetScrollView: { flexGrow: 0, flexShrink: 1 },
  sheetScroll: { paddingHorizontal: wp(24), paddingBottom: hp(8), alignItems: 'center' },
  modalPriceBadge: {
    backgroundColor: '#0EA5E9', paddingHorizontal: wp(20),
    paddingVertical: hp(8), borderRadius: wp(24), marginBottom: hp(20),
  },
  modalPriceText: { fontSize: fontSize(16), fontWeight: '800', color: '#FFFFFF' },
  modalIconWrapper: {
    width: wp(96), height: wp(96), borderRadius: wp(48),
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: hp(20),
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  modalTitle: {
    fontSize: fontSize(22), fontWeight: '800', color: '#1E293B',
    textAlign: 'center', marginBottom: hp(8),
  },
  divider: {
    width: '100%', height: 1, backgroundColor: '#F1F5F9', marginVertical: hp(16),
  },
  modalDesc: {
    fontSize: fontSize(15), color: '#475569',
    lineHeight: fontSize(23), textAlign: 'center', width: '100%',
  },
  modalMeta: {
    width: '100%', marginTop: hp(20),
    backgroundColor: '#F8FAFC', borderRadius: wp(16),
    padding: wp(16), gap: hp(12),
  },
  modalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: wp(10) },
  modalMetaText: {
    fontSize: fontSize(14), color: '#475569', fontWeight: '500', flex: 1,
  },
  priceBreakdown: {
    width: '100%', marginTop: hp(20),
    backgroundColor: '#F8FAFC', borderRadius: wp(16),
    padding: wp(16),
  },
  priceBreakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: hp(6),
  },
  priceBreakdownLabel: { fontSize: fontSize(13), color: '#64748B', fontWeight: '500' },
  priceBreakdownValue: { fontSize: fontSize(14), color: '#1E293B', fontWeight: '700' },
  priceBreakdownDeposit: { color: '#0EA5E9' },
  priceBreakdownNote: {
    fontSize: fontSize(12), color: '#94A3B8', lineHeight: fontSize(17),
    marginTop: hp(8),
  },
  balanceInfo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginTop: hp(20),
    backgroundColor: '#EFF6FF', borderRadius: wp(12),
    paddingHorizontal: wp(16), paddingVertical: hp(12),
  },
  balanceInfoLabel: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
  balanceInfoValue: { fontSize: fontSize(16), fontWeight: '800', color: '#0EA5E9' },
  balanceInfoInsufficient: { color: '#EF4444' },
  sheetFooter: {
    padding: wp(20), paddingBottom: hp(32),
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  buyBtn: {
    backgroundColor: '#0EA5E9', borderRadius: wp(16),
    paddingVertical: hp(16), alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  buyBtnDisabled: { backgroundColor: '#F1F5F9', shadowOpacity: 0 },
  buyBtnText: { fontSize: fontSize(17), fontWeight: '800', color: '#FFFFFF' },
  buyBtnTextDisabled: { fontSize: fontSize(17), fontWeight: '700', color: '#94A3B8' },

  // ── Confirm ──
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: wp(24),
  },
  confirmBox: {
    backgroundColor: '#FFFFFF', borderRadius: wp(20),
    padding: wp(24), width: '100%', gap: hp(16),
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  confirmTitle: {
    fontSize: fontSize(18), fontWeight: '800', color: '#1E293B', textAlign: 'center',
  },
  confirmDesc: {
    fontSize: fontSize(15), color: '#475569', textAlign: 'center', lineHeight: fontSize(22),
  },
  confirmPrice: { fontWeight: '800', color: '#0EA5E9' },
  confirmCashNote: {
    fontSize: fontSize(12), color: '#94A3B8', lineHeight: fontSize(17), textAlign: 'center',
  },
  confirmButtons: { flexDirection: 'row', gap: wp(12) },
  confirmCancelBtn: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: wp(14),
    paddingVertical: hp(14), alignItems: 'center',
  },
  confirmCancelText: { fontSize: fontSize(15), fontWeight: '700', color: '#64748B' },
  confirmOkBtn: {
    flex: 1.6, backgroundColor: '#0EA5E9', borderRadius: wp(14),
    paddingVertical: hp(14), alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmOkText: { fontSize: fontSize(15), fontWeight: '800', color: '#FFFFFF' },
});
