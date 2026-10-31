import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, HelpCircle, CreditCard, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/MainStack';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { useLanguage } from '@/shared/lib/hooks';
import { useBonus } from '@/shared/lib/hooks/useBonus';
import { wp, hp, fontSize } from '@/shared/lib/responsive';
import { formatTwaAmount } from '@/shared/constants/adRewards';
import { paymentApi } from '@/shared/api/paymentApi';

// 1 EUR = 1 TWA, no bonus/cashback — what you pay is exactly what you get.
const AMOUNTS = [
  { value: 2.5,  popular: true },
  { value: 5,    popular: false },
  { value: 10,   popular: false },
  { value: 20,   popular: false },
  { value: 50,   popular: false },
];

const LABELS = {
  ru: {
    title: 'Buy TWA',
    currentBalance: 'Текущий баланс',
    balanceHint: 'Пополняйте баланс и получайте больше бонусов',
    chooseAmount: 'Выберите сумму',
    points: 'баллов',
    popular: 'Популярно',
    customAmount: 'Другая сумма',
    customSub: 'Введите вручную',
    customPlaceholder: 'Сумма в EUR',
    customApply: 'Купить',
    customCancel: 'Отмена',
    customError: 'Введите сумму больше 0',
    payMethod: 'Способ оплаты',
    cardName: 'Банковская карта',
    cardSub: 'Visa, Mastercard',
    button: 'Купить TWA',
    comingSoonTitle: 'Скоро',
    comingSoonMsg: 'Платёжная система скоро будет подключена. Следите за обновлениями!',
  },
  en: {
    title: 'Buy TWA',
    currentBalance: 'Current balance',
    balanceHint: 'Top up your balance and get more bonuses',
    chooseAmount: 'Choose amount',
    points: 'points',
    popular: 'Popular',
    customAmount: 'Custom amount',
    customSub: 'Enter manually',
    customPlaceholder: 'Amount in EUR',
    customApply: 'Buy',
    customCancel: 'Cancel',
    customError: 'Enter amount greater than 0',
    payMethod: 'Payment method',
    cardName: 'Bank card',
    cardSub: 'Visa, Mastercard',
    button: 'Buy TWA',
    comingSoonTitle: 'Coming Soon',
    comingSoonMsg: 'Payment system will be available soon. Stay tuned!',
  },
  uk: {
    title: 'Buy TWA',
    currentBalance: 'Поточний баланс',
    balanceHint: 'Поповнюйте баланс і отримуйте більше бонусів',
    chooseAmount: 'Оберіть суму',
    points: 'балів',
    popular: 'Популярно',
    customAmount: 'Інша сума',
    customSub: 'Введіть вручну',
    customPlaceholder: 'Сума в EUR',
    customApply: 'Купити',
    customCancel: 'Скасувати',
    customError: 'Введіть суму більше 0',
    payMethod: 'Спосіб оплати',
    cardName: 'Банківська картка',
    cardSub: 'Visa, Mastercard',
    button: 'Купити TWA',
    comingSoonTitle: 'Незабаром',
    comingSoonMsg: 'Платіжна система буде підключена незабаром. Стежте за оновленнями!',
  },
} as const;

export const TopUpScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language } = useLanguage();
  const { balance } = useBonus();
  const userBalance = balance?.available ?? 0;

  const [selectedAmount, setSelectedAmount] = useState(2.5);
  const [paying, setPaying] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  const L = LABELS[language] ?? LABELS.ru;

  const selectedItem = AMOUNTS.find((a) => a.value === selectedAmount) ?? { value: selectedAmount, popular: false };

  // Accepts an explicit amount so the custom-amount modal can go straight to
  // payment on tap, instead of first setting selectedAmount (async state)
  // and relying on the separate bottom button on the next render.
  const handleTopUp = async (amountOverride?: number) => {
    const amount = amountOverride ?? selectedItem.value;
    setPaying(true);
    try {
      const wfpLang = language === 'uk' ? 'UA' : language === 'en' ? 'EN' : 'RU';
      const result = await paymentApi.createPayment({
        amount,
        currency: 'EUR',
        bonusPercent: 0,
        language: wfpLang,
      });
      console.log('[TopUp] backend response:', JSON.stringify(result));

      const paymentUrl = (result as any)?.paymentUrl ?? (result as any)?.url;
      const orderReference = (result as any)?.orderReference ?? (result as any)?.orderRef ?? (result as any)?.order_reference;

      if (!paymentUrl) {
        Alert.alert('Ошибка', `Нет paymentUrl. Ответ бэка:\n${JSON.stringify(result)}`, [{ text: 'OK' }]);
        return;
      }

      navigation.navigate('PaymentWebView', {
        paymentUrl,
        orderReference: orderReference ?? '',
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        String(err);
      Alert.alert('Ошибка', `${err?.response?.status ?? ''} ${msg}`, [{ text: 'OK' }]);
    } finally {
      setPaying(false);
    }
  };

  // Custom amount goes straight to payment on submit — no separate "apply
  // then press the bottom button" step.
  const submitCustomAmount = async () => {
    const val = parseFloat(customText.replace(',', '.'));
    if (!(val > 0)) {
      Alert.alert('', L.customError);
      return;
    }
    setSelectedAmount(val);
    setCustomModalVisible(false);
    await handleTopUp(val);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{L.title}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => Alert.alert(L.comingSoonTitle, L.comingSoonMsg)}>
          <HelpCircle size={22} color="#0EA5E9" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.planeEmoji}>✈</Text>
              <Text style={styles.balanceLabel}>{L.currentBalance}</Text>
            </View>
            <View style={styles.balanceAmountRow}>
              <Text style={styles.planeEmoji}>✈</Text>
              <Text style={styles.balanceAmount}>{formatTwaAmount(userBalance)}</Text>
            </View>
            <Text style={styles.balanceHint}>{L.balanceHint}</Text>
          </View>
          <Image
            source={require('../../../assets/wallet.png')}
            style={styles.walletImage}
            resizeMode="contain"
          />
        </View>

        {/* ── Amount Selection ── */}
        <Text style={styles.sectionTitle}>{L.chooseAmount}</Text>
        <View style={styles.amountsGrid}>
          {AMOUNTS.map((item) => {
            const isSelected = selectedAmount === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.amountCard, isSelected && styles.amountCardSelected]}
                activeOpacity={0.75}
                onPress={() => setSelectedAmount(item.value)}>
                {item.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>⭐ {L.popular}</Text>
                  </View>
                )}
                <Text style={styles.planeIcon}>✈</Text>
                <Text style={[styles.amountValue, isSelected && styles.amountValueSelected]}>
                  {item.value.toFixed(2)}
                </Text>
                <Text style={styles.amountUnit}>TWA</Text>
                <Text style={[styles.eurPrice, isSelected && styles.eurPriceSelected]}>
                  €{item.value.toFixed(2)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Custom amount card */}
          <TouchableOpacity
            style={[styles.amountCard, !AMOUNTS.some(a => a.value === selectedAmount) && styles.amountCardSelected]}
            activeOpacity={0.75}
            onPress={() => { setCustomText(''); setCustomModalVisible(true); }}>
            <View style={styles.customIcon}>
              <Text style={styles.customIconText}>✏️</Text>
            </View>
            <Text style={styles.customAmountTitle}>{L.customAmount}</Text>
            <Text style={styles.customAmountSub}>{L.customSub}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Payment Method ── */}
        <Text style={styles.sectionTitle}>{L.payMethod}</Text>
        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentIconBox}>
              <CreditCard size={wp(22)} color="#0EA5E9" strokeWidth={2} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>{L.cardName}</Text>
              <Text style={styles.paymentSub}>{L.cardSub}</Text>
            </View>
            <View style={styles.checkCircle}>
              <Check size={wp(14)} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
        </View>

        <View style={{ height: hp(100) }} />
      </ScrollView>

      {/* ── Custom Amount Modal ── */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setCustomModalVisible(false)}
          />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{L.customAmount}</Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalCurrency}>€</Text>
              <TextInput
                style={styles.modalInput}
                value={customText}
                onChangeText={setCustomText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void submitCustomAmount()}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomModalVisible(false)}>
                <Text style={styles.modalCancelText}>{L.customCancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => void submitCustomAmount()}>
                <Text style={styles.modalApplyText}>{L.customApply}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Bottom Button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.topUpBtn, paying && styles.topUpBtnDisabled]}
          activeOpacity={0.85}
          disabled={paying}
          onPress={() => void handleTopUp()}>
          {paying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.topUpBtnIcon}>🔒</Text>
              <Text style={styles.topUpBtnText}>{L.button}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
  },
  iconBtn: {
    width: wp(40),
    height: wp(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
  },

  scroll: {
    paddingHorizontal: wp(16),
    paddingTop: hp(4),
  },

  // ── Balance Card ──
  balanceCard: {
    backgroundColor: '#38BDF8',
    borderRadius: wp(20),
    paddingLeft: wp(20),
    paddingRight: wp(8),
    paddingVertical: hp(20),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(24),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
    marginBottom: hp(8),
  },
  balanceLabel: {
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  planeEmoji: {
    fontSize: fontSize(16),
    color: '#FFD700',
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
    marginBottom: hp(8),
  },
  balanceAmount: {
    fontSize: fontSize(40),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceHint: {
    fontSize: fontSize(13),
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    lineHeight: fontSize(18),
    maxWidth: '90%',
  },
  walletImage: {
    width: wp(110),
    height: wp(110),
  },

  // ── Section Title ──
  sectionTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(14),
  },

  // ── Amounts Grid ──
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(10),
    marginBottom: hp(24),
  },
  amountCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    paddingVertical: hp(14),
    paddingHorizontal: wp(10),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: '28%',
    maxWidth: '32%',
  },
  amountCardSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#F0F9FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: '#0EA5E9',
    borderTopLeftRadius: wp(14),
    borderTopRightRadius: wp(14),
    paddingVertical: hp(3),
    alignItems: 'center',
  },
  popularText: {
    fontSize: fontSize(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planeIcon: {
    fontSize: fontSize(18),
    color: '#F59E0B',
    marginTop: hp(8),
    marginBottom: hp(2),
  },
  amountValue: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(2),
  },
  amountValueSelected: {
    color: '#0EA5E9',
  },
  amountUnit: {
    fontSize: fontSize(12),
    color: '#64748B',
    marginBottom: hp(8),
  },
  eurPrice: {
    fontSize: fontSize(13),
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: hp(6),
  },
  eurPriceSelected: {
    color: '#0EA5E9',
  },
  // Custom amount
  customIcon: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(22),
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(8),
  },
  customIconText: {
    fontSize: fontSize(20),
  },
  customAmountTitle: {
    fontSize: fontSize(14),
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: hp(2),
  },
  customAmountSub: {
    fontSize: fontSize(11),
    color: '#94A3B8',
    textAlign: 'center',
  },

  // ── Payment Method ──
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    paddingVertical: hp(4),
    marginBottom: hp(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
  },
  paymentIconBox: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(12),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(14),
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: hp(2),
  },
  paymentSub: {
    fontSize: fontSize(13),
    color: '#94A3B8',
  },
  checkCircle: {
    width: wp(26),
    height: wp(26),
    borderRadius: wp(13),
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Bottom Button ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
    paddingBottom: hp(28),
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  topUpBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: wp(16),
    paddingVertical: hp(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(10),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  topUpBtnIcon: {
    fontSize: fontSize(18),
  },
  topUpBtnText: {
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topUpBtnDisabled: {
    opacity: 0.7,
  },

  // ── Custom Amount Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(24),
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    padding: wp(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(16),
    textAlign: 'center',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: wp(12),
    borderWidth: 2,
    borderColor: '#0EA5E9',
    paddingHorizontal: wp(16),
    marginBottom: hp(20),
  },
  modalCurrency: {
    fontSize: fontSize(22),
    fontWeight: '700',
    color: '#0EA5E9',
    marginRight: wp(8),
  },
  modalInput: {
    flex: 1,
    fontSize: fontSize(24),
    fontWeight: '700',
    color: '#1E293B',
    paddingVertical: hp(14),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: wp(12),
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: hp(14),
    borderRadius: wp(12),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#64748B',
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: hp(14),
    borderRadius: wp(12),
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalApplyText: {
    fontSize: fontSize(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
