import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/app/navigation/MainStack';
import { installmentService } from '@/entities/installment/model/installmentService';
import { formatMoney, parseMoneyToMinor } from '@/features/installment/lib/money';
import { useLanguage } from '@/shared/lib/hooks';
import type { Installment, InstallmentPaymentStatus } from '@/shared/types/installment';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { Input } from '@/shared/ui/Input';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'InstallmentSchedule'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'InstallmentSchedule'>;

const STATUS_COLORS: Record<InstallmentPaymentStatus, string> = {
  pending: '#F59E0B',
  paid: '#16A34A',
  overdue: '#EF4444',
  cancelled: '#64748B',
};

export const InstallmentScheduleScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { t, language } = useLanguage();
  const copy = t.main.installment;
  const [installment, setInstallment] = useState<Installment>();
  const [loading, setLoading] = useState(true);
  const [customPaymentVisible, setCustomPaymentVisible] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [payingCustom, setPayingCustom] = useState(false);
  const [payingOff, setPayingOff] = useState(false);
  const submittingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void installmentService
        .getInstallmentById(route.params.installmentId)
        .then((result) => {
          if (active) setInstallment(result);
        })
        .catch(() => {
          if (active) setInstallment(undefined);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [route.params.installmentId]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!installment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{copy.notFoundTitle}</Text>
          <Text style={styles.emptyText}>{copy.notFoundText}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>{copy.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canPay = installment.status === 'active' && installment.remainingAmount > 0;

  const handleSubmitCustomPayment = async () => {
    if (submittingRef.current) return;
    const amount = parseMoneyToMinor(customAmountInput);
    if (!amount || amount <= 0 || amount > installment.remainingAmount) return;

    submittingRef.current = true;
    setPayingCustom(true);
    try {
      const { paymentUrl, orderReference } = await installmentService.payCustomAmount(
        installment.id,
        amount,
      );
      setCustomPaymentVisible(false);
      setCustomAmountInput('');
      navigation.navigate('PaymentWebView', { paymentUrl, orderReference });
    } catch (error: any) {
      Alert.alert(t.common.error, error?.error || error?.message || copy.customPaymentError);
    } finally {
      submittingRef.current = false;
      setPayingCustom(false);
    }
  };

  const submitPayoff = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPayingOff(true);
    try {
      const { paymentUrl, orderReference } = await installmentService.payoffInstallment(
        installment.id,
      );
      navigation.navigate('PaymentWebView', { paymentUrl, orderReference });
    } catch (error: any) {
      Alert.alert(t.common.error, error?.error || error?.message || copy.customPaymentError);
    } finally {
      submittingRef.current = false;
      setPayingOff(false);
    }
  };

  const handlePayOffEarly = () => {
    Alert.alert(
      copy.payOffEarlyConfirmTitle,
      copy.payOffEarlyConfirmText.replace(
        '{amount}',
        formatMoney(installment.remainingAmount, language),
      ),
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: copy.payOffEarly, onPress: () => void submitPayoff() },
      ],
    );
  };

  const customAmountValue = parseMoneyToMinor(customAmountInput);
  const isCustomAmountValid =
    customAmountValue !== null &&
    customAmountValue > 0 &&
    customAmountValue <= installment.remainingAmount;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(
      language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' },
    ).format(new Date(value));

  const getStatusLabel = (status: InstallmentPaymentStatus) => copy.paymentStatuses[status];
  const paidCount = installment.payments.filter(
    (payment) => payment.status === 'paid',
  ).length;
  const remainingCount = installment.payments.length - paidCount;
  const nextPayment = installment.payments.find(
    (payment) => payment.status === 'overdue' || payment.status === 'pending',
  );
  const progressPercent =
    installment.totalAmount > 0
      ? Math.min(100, Math.round((installment.paidAmount / installment.totalAmount) * 100))
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.scheduleTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>{copy.totalAmount}</Text>
              <Text style={styles.heroAmount}>
                {formatMoney(installment.totalAmount, language)}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                {copy.installmentStatuses[installment.status]}
              </Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.metricLabel}>{copy.departureDate}</Text>
              <Text style={styles.metricValue}>
                {installment.tourDate ? formatDate(installment.tourDate) : copy.amountEmpty}
              </Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.metricLabel}>{copy.surcharge}</Text>
              <Text style={styles.metricValue}>{installment.surchargePercent}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.amountGrid}>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{copy.paidAmount}</Text>
            <Text style={[styles.amountValue, styles.paidValue]}>
              {formatMoney(installment.paidAmount, language)}
            </Text>
          </View>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{copy.remainingAmount}</Text>
            <Text style={styles.amountValue}>
              {formatMoney(installment.remainingAmount, language)}
            </Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>
              {copy.paymentProgress
                .replace('{paid}', String(paidCount))
                .replace('{total}', String(installment.payments.length))}
            </Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressCounts}>
            <View>
              <Text style={styles.progressCountLabel}>{copy.closedPayments}</Text>
              <Text style={styles.progressCountValue}>{paidCount}</Text>
            </View>
            <View style={styles.progressCountRight}>
              <Text style={styles.progressCountLabel}>{copy.remainingPayments}</Text>
              <Text style={styles.progressCountValue}>{remainingCount}</Text>
            </View>
          </View>
        </View>

        {nextPayment && (
          <View style={styles.nextPaymentCard}>
            <CalendarDays size={21} color="#0284C7" strokeWidth={2} />
            <View style={styles.nextPaymentInfo}>
              <Text style={styles.nextPaymentLabel}>{copy.nextPayment}</Text>
              <Text style={styles.nextPaymentValue}>
                {formatMoney(nextPayment.amount, language)} · {formatDate(nextPayment.dueDate)}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{copy.paymentHistory}</Text>
        <View style={styles.listCard}>
          {installment.payments.map((payment, index) => {
            const color = STATUS_COLORS[payment.status];
            const isPaid = payment.status === 'paid';
            const isNext = payment.id === nextPayment?.id;
            const StatusIcon =
              isPaid
                ? CheckCircle2
                : payment.status === 'cancelled'
                  ? XCircle
                  : payment.status === 'pending'
                    ? Clock3
                    : CalendarDays;

            return (
              <TouchableOpacity
                key={payment.id}
                accessibilityRole="button"
                activeOpacity={0.75}
                onPress={() =>
                  navigation.navigate('InstallmentPaymentDetails', {
                    installmentId: installment.id,
                    paymentId: payment.id,
                  })
                }
                style={[
                  styles.paymentRow,
                  index > 0 && styles.paymentRowBorder,
                  isPaid && styles.paymentRowPaid,
                  isNext && styles.paymentRowNext,
                ]}>
                <View style={[styles.statusIcon, { backgroundColor: `${color}18` }]}>
                  <StatusIcon size={22} color={color} strokeWidth={2} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentTitle, isPaid && styles.paymentTitlePaid]}>
                    {payment.label ||
                      copy.paymentNumber.replace('{number}', String(payment.sequenceNumber))}
                  </Text>
                  <Text style={styles.paymentDate}>{formatDate(payment.dueDate)}</Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[styles.paymentAmount, isPaid && styles.paymentAmountPaid]}>
                    {formatMoney(payment.amount, language)}
                  </Text>
                  <Text style={[styles.paymentStatus, { color }]}>
                    {getStatusLabel(payment.status)}
                  </Text>
                </View>
                <ChevronRight
                  size={19}
                  color={isPaid ? '#CBD5E1' : '#64748B'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {canPay && (
          <View style={styles.flexActions}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={payingCustom || payingOff}
              onPress={() => setCustomPaymentVisible(true)}
              style={styles.actionButton}>
              <Wallet size={19} color="#0EA5E9" strokeWidth={2} />
              <Text style={styles.actionButtonText}>{copy.makePayment}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={payingCustom || payingOff}
              onPress={handlePayOffEarly}
              style={[styles.actionButton, styles.actionButtonPrimary]}>
              {payingOff ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Zap size={19} color="#FFFFFF" strokeWidth={2} />
              )}
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                {copy.payOffEarly}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={customPaymentVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomPaymentVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCustomPaymentVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{copy.makePayment}</Text>
            <Input
              label={copy.makePaymentAmountLabel}
              value={customAmountInput}
              onChangeText={setCustomAmountInput}
              placeholder={copy.amountPlaceholder}
              keyboardType="decimal-pad"
              autoFocus
              error={
                customAmountInput.length > 0 && !isCustomAmountValid
                  ? copy.amountError
                  : undefined
              }
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.modalCancelButton}
                onPress={() => setCustomPaymentVisible(false)}>
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!isCustomAmountValid || payingCustom}
                style={[
                  styles.modalPayButton,
                  (!isCustomAmountValid || payingCustom) && styles.modalPayButtonDisabled,
                ]}
                onPress={() => void handleSubmitCustomPayment()}>
                {payingCustom ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPayText}>{copy.payNow}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSpacer: { width: wp(40) },
  content: { padding: wp(16), paddingBottom: hp(40) },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    padding: wp(20),
    borderRadius: wp(22),
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { fontSize: fontSize(13), color: 'rgba(255,255,255,0.82)' },
  heroAmount: { marginTop: hp(4), fontSize: fontSize(28), fontWeight: '800', color: '#FFFFFF' },
  activeBadge: {
    paddingHorizontal: wp(10),
    paddingVertical: hp(6),
    borderRadius: wp(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeBadgeText: { fontSize: fontSize(12), fontWeight: '700', color: '#FFFFFF' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: hp(16) },
  heroMetrics: { flexDirection: 'row' },
  heroMetric: { flex: 1 },
  metricLabel: { fontSize: fontSize(12), color: 'rgba(255,255,255,0.75)' },
  metricValue: { marginTop: hp(3), fontSize: fontSize(15), fontWeight: '700', color: '#FFFFFF' },
  amountGrid: { flexDirection: 'row', gap: wp(12), marginTop: hp(16) },
  amountCard: {
    flex: 1,
    padding: wp(16),
    borderRadius: wp(18),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  amountLabel: { fontSize: fontSize(12), color: '#64748B' },
  amountValue: { marginTop: hp(6), fontSize: fontSize(17), fontWeight: '800', color: '#1E293B' },
  paidValue: { color: '#16A34A' },
  progressCard: {
    marginTop: hp(16),
    padding: wp(16),
    borderRadius: wp(18),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: { flex: 1, fontSize: fontSize(13), fontWeight: '700', color: '#334155' },
  progressPercent: { marginLeft: wp(10), fontSize: fontSize(14), fontWeight: '800', color: '#0284C7' },
  progressTrack: {
    height: hp(8),
    marginTop: hp(12),
    overflow: 'hidden',
    borderRadius: hp(4),
    backgroundColor: '#E2E8F0',
  },
  progressFill: { height: '100%', borderRadius: hp(4), backgroundColor: '#0EA5E9' },
  progressCounts: {
    marginTop: hp(13),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressCountRight: { alignItems: 'flex-end' },
  progressCountLabel: { fontSize: fontSize(11), color: '#64748B' },
  progressCountValue: { marginTop: hp(2), fontSize: fontSize(14), fontWeight: '700', color: '#1E293B' },
  nextPaymentCard: {
    marginTop: hp(16),
    padding: wp(14),
    borderRadius: wp(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(10),
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  nextPaymentInfo: { flex: 1 },
  nextPaymentLabel: { fontSize: fontSize(11), color: '#0369A1' },
  nextPaymentValue: { marginTop: hp(3), fontSize: fontSize(13), fontWeight: '700', color: '#0C4A6E' },
  sectionTitle: {
    marginTop: hp(24),
    marginBottom: hp(12),
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentRow: {
    minHeight: hp(82),
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(14),
    gap: wp(10),
  },
  paymentRowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  paymentRowPaid: { backgroundColor: '#FAFCFB' },
  paymentRowNext: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  statusIcon: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: fontSize(14), fontWeight: '700', color: '#1E293B' },
  paymentTitlePaid: { color: '#64748B' },
  paymentDate: { marginTop: hp(3), fontSize: fontSize(12), color: '#64748B' },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: fontSize(14), fontWeight: '700', color: '#1E293B' },
  paymentAmountPaid: { color: '#64748B' },
  paymentStatus: { marginTop: hp(3), fontSize: fontSize(11), fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: wp(24) },
  emptyTitle: { fontSize: fontSize(20), fontWeight: '700', color: '#1E293B' },
  emptyText: { marginTop: hp(8), textAlign: 'center', fontSize: fontSize(14), color: '#64748B' },
  emptyButton: {
    marginTop: hp(20),
    paddingHorizontal: wp(22),
    paddingVertical: hp(12),
    borderRadius: wp(14),
    backgroundColor: '#0EA5E9',
  },
  emptyButtonText: { fontSize: fontSize(14), fontWeight: '700', color: '#FFFFFF' },
  flexActions: { flexDirection: 'row', gap: wp(12), marginTop: hp(20) },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    minHeight: hp(52),
    borderRadius: wp(16),
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  actionButtonPrimary: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  actionButtonText: { fontSize: fontSize(14), fontWeight: '700', color: '#0369A1' },
  actionButtonTextPrimary: { color: '#FFFFFF' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(20),
  },
  modalCard: {
    width: '100%',
    maxWidth: wp(360),
    borderRadius: wp(22),
    backgroundColor: '#FFFFFF',
    padding: wp(18),
  },
  modalTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(14),
    textAlign: 'center',
  },
  modalButtons: { flexDirection: 'row', gap: wp(12), marginTop: hp(4) },
  modalCancelButton: {
    flex: 1,
    minHeight: hp(48),
    borderRadius: wp(14),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: fontSize(14), fontWeight: '700', color: '#475569' },
  modalPayButton: {
    flex: 1,
    minHeight: hp(48),
    borderRadius: wp(14),
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPayButtonDisabled: { opacity: 0.5 },
  modalPayText: { fontSize: fontSize(14), fontWeight: '700', color: '#FFFFFF' },
});
