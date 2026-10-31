import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Hash } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/app/navigation/MainStack';
import { installmentService } from '@/entities/installment/model/installmentService';
import { formatMoney } from '@/features/installment/lib/money';
import { useLanguage } from '@/shared/lib/hooks';
import type { Installment, InstallmentPayment } from '@/shared/types/installment';
import { Button } from '@/shared/ui/Button';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'InstallmentPaymentDetails'
>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'InstallmentPaymentDetails'>;

export const InstallmentPaymentDetailsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { t, language } = useLanguage();
  const copy = t.main.installment;
  const [installment, setInstallment] = useState<Installment>();
  const [payment, setPayment] = useState<InstallmentPayment>();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      installmentService.getInstallmentById(route.params.installmentId),
      installmentService.getPaymentById(
        route.params.installmentId,
        route.params.paymentId,
      ),
    ])
      .then(([installmentResult, paymentResult]) => {
        if (active) {
          setInstallment(installmentResult);
          setPayment(paymentResult);
        }
      })
      .catch(() => {
        if (active) {
          setInstallment(undefined);
          setPayment(undefined);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route.params.installmentId, route.params.paymentId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!installment || !payment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{copy.paymentNotFoundTitle}</Text>
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

  const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US';
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));

  const previousPaid = installment.payments
    .filter((item) => item.sequenceNumber < payment.sequenceNumber)
    .every((item) => item.status === 'paid');
  const canPay = payment.status === 'pending' && previousPaid;

  const handlePayment = async () => {
    if (!installment || !payment || paying) return;
    setPaying(true);
    try {
      const { paymentUrl, orderReference } = await installmentService.payInstallmentPayment(
        installment.id,
        payment.id,
      );
      navigation.navigate('PaymentWebView', { paymentUrl, orderReference });
    } catch {
      Alert.alert(copy.paymentStartErrorTitle, copy.paymentStartErrorText, [
        { text: t.common.ok },
      ]);
    } finally {
      setPaying(false);
    }
  };

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
        <Text style={styles.headerTitle}>{copy.paymentDetailsTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.amountCard}>
          <View style={styles.cardIcon}>
            <CreditCard size={30} color="#0EA5E9" strokeWidth={2} />
          </View>
          <Text style={styles.paymentNumber}>
            {copy.paymentNumber.replace('{number}', String(payment.sequenceNumber))}
          </Text>
          <Text style={styles.amount}>
            {formatMoney(payment.amount, language)}
          </Text>
          <View style={[styles.statusBadge, styles[`status_${payment.status}`]]}>
            <Text style={[styles.statusText, styles[`statusText_${payment.status}`]]}>
              {copy.paymentStatuses[payment.status]}
            </Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <CalendarDays size={20} color="#0EA5E9" strokeWidth={2} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{copy.dueDate}</Text>
              <Text style={styles.detailValue}>{formatDate(payment.dueDate)}</Text>
            </View>
          </View>

          {payment.paidAt && (
            <View style={[styles.detailRow, styles.detailBorder]}>
              <View style={[styles.detailIcon, styles.paidIcon]}>
                <CheckCircle2 size={20} color="#16A34A" strokeWidth={2} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{copy.paidAt}</Text>
                <Text style={styles.detailValue}>{formatDate(payment.paidAt)}</Text>
              </View>
            </View>
          )}

          {payment.orderReference && (
            <View style={[styles.detailRow, styles.detailBorder]}>
              <View style={styles.detailIcon}>
                <Hash size={20} color="#0EA5E9" strokeWidth={2} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{copy.orderReference}</Text>
                <Text selectable style={styles.referenceValue}>
                  {payment.orderReference}
                </Text>
              </View>
            </View>
          )}
        </View>

        {canPay && (
          <Button
            title={paying ? t.common.loading : copy.payNow}
            onPress={handlePayment}
            disabled={paying}
            style={paying ? styles.disabledButton : undefined}
          />
        )}
        {payment.status === 'pending' && !canPay && (
          <View style={styles.lockedNotice}>
            <Text style={styles.lockedNoticeText}>{copy.paymentLocked}</Text>
          </View>
        )}
      </ScrollView>
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
  content: { padding: wp(16), paddingBottom: hp(40), gap: hp(16) },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  amountCard: {
    alignItems: 'center',
    padding: wp(24),
    borderRadius: wp(22),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  cardIcon: {
    width: wp(60),
    height: wp(60),
    borderRadius: wp(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  paymentNumber: {
    marginTop: hp(14),
    fontSize: fontSize(14),
    fontWeight: '600',
    color: '#64748B',
  },
  amount: {
    marginTop: hp(4),
    fontSize: fontSize(30),
    fontWeight: '800',
    color: '#1E293B',
  },
  statusBadge: {
    marginTop: hp(12),
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(20),
  },
  statusText: { fontSize: fontSize(12), fontWeight: '700' },
  status_pending: { backgroundColor: '#FEF3C7' },
  status_paid: { backgroundColor: '#DCFCE7' },
  status_overdue: { backgroundColor: '#FEE2E2' },
  status_cancelled: { backgroundColor: '#E2E8F0' },
  statusText_pending: { color: '#B45309' },
  statusText_paid: { color: '#15803D' },
  statusText_overdue: { color: '#DC2626' },
  statusText_cancelled: { color: '#475569' },
  detailsCard: {
    overflow: 'hidden',
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: wp(16), gap: wp(12) },
  detailBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailIcon: {
    width: wp(42),
    height: wp(42),
    borderRadius: wp(13),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  paidIcon: { backgroundColor: '#DCFCE7' },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: fontSize(12), color: '#64748B' },
  detailValue: {
    marginTop: hp(3),
    fontSize: fontSize(15),
    fontWeight: '700',
    color: '#1E293B',
  },
  referenceValue: {
    marginTop: hp(3),
    fontSize: fontSize(13),
    fontWeight: '600',
    color: '#1E293B',
  },
  lockedNotice: {
    padding: wp(16),
    borderRadius: wp(16),
    backgroundColor: '#F1F5F9',
  },
  disabledButton: { opacity: 0.45 },
  lockedNoticeText: {
    textAlign: 'center',
    fontSize: fontSize(13),
    lineHeight: fontSize(19),
    color: '#64748B',
  },
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
});
