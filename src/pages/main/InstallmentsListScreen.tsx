import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarClock, ChevronRight, CreditCard } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/app/navigation/MainStack';
import { installmentService } from '@/entities/installment/model/installmentService';
import { formatMoney } from '@/features/installment/lib/money';
import { useLanguage } from '@/shared/lib/hooks';
import type { Installment } from '@/shared/types/installment';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { Button } from '@/shared/ui/Button';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'InstallmentsList'>;

export const InstallmentsListScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t, language } = useLanguage();
  const copy = t.main.installment;
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void installmentService
        .getInstallments()
        .then((result) => {
          // Полностью выплаченные рассрочки не должны захламлять список —
          // как только последний платёж закрыт, она пропадает отсюда.
          if (active) setInstallments(result.filter((item) => item.status !== 'completed'));
        })
        .catch(() => {
          if (active) setInstallments([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US';
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));

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
        <Text style={styles.headerTitle}>{copy.installmentsTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.addButtonContainer}>
        <Button
          title={copy.payTourButton}
          onPress={() => navigation.navigate('TourPayment')}
        />
        <Button
          title={copy.addInstallment}
          variant="secondary"
          onPress={() => navigation.navigate('InstallmentCalculator')}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : installments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <CalendarClock size={40} color="#0EA5E9" strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>{copy.noInstallments}</Text>
          <Text style={styles.emptyText}>{copy.emptyInstallmentsDescription}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {installments.map((installment) => {
            const paidCount = installment.payments.filter(
              (payment) => payment.status === 'paid',
            ).length;
            const nextPayment = installment.payments.find(
              (payment) => payment.status === 'overdue' || payment.status === 'pending',
            );

            return (
              <TouchableOpacity
                key={installment.id}
                accessibilityRole="button"
                activeOpacity={0.78}
                onPress={() =>
                  navigation.navigate('InstallmentSchedule', {
                    installmentId: installment.id,
                  })
                }
                style={styles.installmentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <CreditCard size={23} color="#0284C7" strokeWidth={2} />
                  </View>
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardLabel}>{copy.totalAmount}</Text>
                    <Text style={styles.cardAmount}>
                      {formatMoney(installment.totalAmount, language)}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {copy.installmentStatuses[installment.status]}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#94A3B8" />
                </View>

                <View style={styles.divider} />
                <View style={styles.metricsGrid}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.departureDate}</Text>
                    <Text style={styles.metricValue}>
                      {installment.tourDate ? formatDate(installment.tourDate) : copy.amountEmpty}
                    </Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.surcharge}</Text>
                    <Text style={styles.metricValue}>{installment.surchargePercent}%</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.paidAmount}</Text>
                    <Text style={[styles.metricValue, styles.paidValue]}>
                      {formatMoney(installment.paidAmount, language)}
                    </Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.remainingAmount}</Text>
                    <Text style={styles.metricValue}>
                      {formatMoney(installment.remainingAmount, language)}
                    </Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.closedPayments}</Text>
                    <Text style={styles.metricValue}>{paidCount}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{copy.remainingPayments}</Text>
                    <Text style={styles.metricValue}>
                      {installment.payments.length - paidCount}
                    </Text>
                  </View>
                </View>

                {nextPayment && (
                  <View style={styles.nextPayment}>
                    <CalendarClock size={18} color="#0284C7" strokeWidth={2} />
                    <Text style={styles.nextPaymentLabel}>{copy.nextPayment}</Text>
                    <Text style={styles.nextPaymentValue}>
                      {formatDate(nextPayment.dueDate)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
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
  addButtonContainer: {
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(4),
    gap: hp(10),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: wp(16), paddingBottom: hp(40), gap: hp(14) },
  installmentCard: {
    padding: wp(17),
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: wp(9) },
  cardIcon: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  cardHeading: { flex: 1 },
  cardLabel: { fontSize: fontSize(11), color: '#64748B' },
  cardAmount: { marginTop: hp(2), fontSize: fontSize(19), fontWeight: '800', color: '#1E293B' },
  statusBadge: {
    paddingHorizontal: wp(9),
    paddingVertical: hp(5),
    borderRadius: wp(20),
    backgroundColor: '#DCFCE7',
  },
  statusText: { fontSize: fontSize(10), fontWeight: '700', color: '#15803D' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: hp(14) },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: hp(13) },
  metric: { width: '50%' },
  metricLabel: { fontSize: fontSize(11), color: '#64748B' },
  metricValue: { marginTop: hp(3), fontSize: fontSize(14), fontWeight: '700', color: '#334155' },
  paidValue: { color: '#16A34A' },
  nextPayment: {
    marginTop: hp(15),
    padding: wp(12),
    borderRadius: wp(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
    backgroundColor: '#F0F9FF',
  },
  nextPaymentLabel: { flex: 1, fontSize: fontSize(12), fontWeight: '600', color: '#0369A1' },
  nextPaymentValue: { fontSize: fontSize(12), fontWeight: '700', color: '#0C4A6E' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: wp(28) },
  emptyIcon: {
    width: wp(80),
    height: wp(80),
    borderRadius: wp(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  emptyTitle: {
    marginTop: hp(18),
    textAlign: 'center',
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyText: {
    marginTop: hp(7),
    textAlign: 'center',
    fontSize: fontSize(14),
    lineHeight: fontSize(20),
    color: '#64748B',
  },
});
