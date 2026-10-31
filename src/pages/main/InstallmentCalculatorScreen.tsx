import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calculator, CalendarDays } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/app/navigation/MainStack';
import { installmentService } from '@/entities/installment/model/installmentService';
import { MIN_FIRST_PAYMENT_RATIO } from '@/features/installment/lib/installmentCalculator';
import {
  formatMoney,
  majorToMinor,
  minorToInputValue,
  parseMoneyToMinor,
} from '@/features/installment/lib/money';
import { useLanguage } from '@/shared/lib/hooks';
import type { InstallmentCalculation } from '@/shared/types/installment';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { CalendarDatePicker } from '@/shared/ui/CalendarDatePicker';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'InstallmentCalculator'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'InstallmentCalculator'>;

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const InstallmentCalculatorScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { t, language } = useLanguage();
  const copy = t.main.installment;

  const initialMinor = route.params?.amount ? majorToMinor(route.params.amount) : null;
  const [amountInput, setAmountInput] = useState(
    initialMinor ? minorToInputValue(initialMinor) : '',
  );
  const [firstPaymentInput, setFirstPaymentInput] = useState('');
  const firstPaymentTouchedRef = useRef(false);
  const [tourDate, setTourDate] = useState<Date | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [calculation, setCalculation] = useState<InstallmentCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const requestIdRef = useRef(0);

  const baseAmount = useMemo(() => parseMoneyToMinor(amountInput), [amountInput]);
  const isAmountValid = baseAmount !== null && baseAmount > 0;
  const firstPayment = useMemo(() => parseMoneyToMinor(firstPaymentInput), [firstPaymentInput]);
  const minFirstPayment =
    baseAmount !== null ? Math.ceil(baseAmount * MIN_FIRST_PAYMENT_RATIO) : null;
  const isFirstPaymentValid =
    firstPayment !== null &&
    firstPayment > 0 &&
    (minFirstPayment === null || firstPayment >= minFirstPayment);

  const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US';
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      date,
    );

  // First payment defaults to the 30% minimum the moment a valid tour cost
  // is entered — but only until the user actually edits it themselves, so
  // typing a bigger upfront amount doesn't get silently overwritten.
  useEffect(() => {
    if (firstPaymentTouchedRef.current) return;
    if (minFirstPayment === null) {
      setFirstPaymentInput('');
      return;
    }
    setFirstPaymentInput(minorToInputValue(minFirstPayment));
  }, [minFirstPayment]);

  useEffect(() => {
    if (!isAmountValid || baseAmount === null || !isFirstPaymentValid || firstPayment === null || !tourDate) {
      setCalculation(null);
      setCalcError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setCalculating(true);
    setCalcError(null);

    const timeout = setTimeout(() => {
      installmentService
        .calculate({ baseAmount, tourDate: toIsoDate(tourDate), firstPayment })
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setCalculation(result);
        })
        .catch((error: any) => {
          if (requestIdRef.current !== requestId) return;
          setCalculation(null);
          setCalcError(error?.error || error?.message || copy.calculateError);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setCalculating(false);
        });
    }, 500);

    return () => clearTimeout(timeout);
  }, [baseAmount, isAmountValid, firstPayment, isFirstPaymentValid, tourDate, copy.calculateError]);

  const handleContinue = async () => {
    if (!calculation || !tourDate || firstPayment === null || creatingRef.current) return;

    creatingRef.current = true;
    setCreating(true);
    try {
      const installment = await installmentService.createInstallment({
        tourId: route.params?.tourId,
        baseAmount: calculation.baseAmount,
        tourDate: toIsoDate(tourDate),
        firstPayment,
      });
      navigation.replace('InstallmentSchedule', { installmentId: installment.id });
    } catch (error: any) {
      Alert.alert(t.common.error, error?.error || error?.message || copy.createError);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const canContinue = !!calculation && !calculating && !creating;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.newInstallment}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Calculator size={30} color="#0EA5E9" strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.introTitle}>{copy.calculatorIntroTitle}</Text>
              <Text style={styles.introText}>{copy.calculatorIntroText}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Input
              label={copy.tourCost}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder={copy.amountPlaceholder}
              keyboardType="decimal-pad"
              returnKeyType="done"
              error={amountInput.length > 0 && !isAmountValid ? copy.amountError : undefined}
            />

            <Input
              label={copy.firstPaymentLabel}
              value={firstPaymentInput}
              onChangeText={(v) => {
                firstPaymentTouchedRef.current = true;
                setFirstPaymentInput(v);
              }}
              placeholder={copy.amountPlaceholder}
              keyboardType="decimal-pad"
              returnKeyType="done"
              error={
                firstPaymentInput.length > 0 && !isFirstPaymentValid
                  ? copy.firstPaymentTooLow.replace(
                      '{min}',
                      minFirstPayment !== null ? formatMoney(minFirstPayment, language) : '',
                    )
                  : undefined
              }
            />

            <Text style={styles.fieldLabel}>{copy.departureDate}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => setPickerVisible(true)}
              style={styles.dateField}>
              <CalendarDays size={20} color="#0EA5E9" strokeWidth={2} />
              <Text style={[styles.dateFieldText, !tourDate && styles.dateFieldPlaceholder]}>
                {tourDate ? formatDate(tourDate) : copy.selectDate}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            {calculating ? (
              <View style={styles.calculatingRow}>
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={styles.calculatingText}>{copy.calculating}</Text>
              </View>
            ) : calcError ? (
              <Text style={styles.calcErrorText}>{calcError}</Text>
            ) : calculation ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{copy.totalAmount}</Text>
                  <Text style={styles.totalAmount}>
                    {formatMoney(calculation.totalAmount, language)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{copy.surcharge}</Text>
                  <Text style={styles.totalAmount}>{calculation.surchargePercent}%</Text>
                </View>
                <View style={styles.divider} />
                {calculation.payments.map((payment) => (
                  <View key={payment.sequenceNumber} style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>{payment.label}</Text>
                    <Text style={styles.scheduleValue}>
                      {formatMoney(payment.amount, language)} · {formatDate(new Date(payment.dueDate))}
                    </Text>
                  </View>
                ))}
                <Text style={styles.previewText}>{copy.preliminaryCalculation}</Text>
              </>
            ) : (
              <Text style={styles.summaryLabel}>{copy.amountEmpty}</Text>
            )}
          </View>

          <Button
            title={creating ? t.common.loading : copy.createInstallment}
            onPress={handleContinue}
            disabled={!canContinue}
            style={!canContinue ? styles.disabledButton : undefined}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarDatePicker
        visible={pickerVisible}
        value={tourDate}
        title={copy.departureDate}
        onSelect={(date) => {
          setTourDate(date);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(14),
    backgroundColor: '#E0F2FE',
    borderRadius: wp(20),
    padding: wp(18),
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  introIcon: {
    width: wp(56),
    height: wp(56),
    borderRadius: wp(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  introTitle: { fontSize: fontSize(18), fontWeight: '700', color: '#0C4A6E' },
  introText: {
    marginTop: hp(4),
    fontSize: fontSize(13),
    lineHeight: fontSize(19),
    color: '#0369A1',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    padding: wp(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  fieldLabel: {
    fontSize: fontSize(14),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: hp(10),
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(10),
    minHeight: hp(54),
    paddingHorizontal: wp(15),
    borderRadius: wp(14),
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  dateFieldText: { fontSize: fontSize(15), fontWeight: '700', color: '#0369A1' },
  dateFieldPlaceholder: { color: '#7DD3FC', fontWeight: '500' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    padding: wp(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(12),
  },
  summaryLabel: { flex: 1, fontSize: fontSize(14), color: '#64748B' },
  totalAmount: { fontSize: fontSize(17), fontWeight: '700', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: hp(14) },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(12),
    paddingVertical: hp(6),
  },
  scheduleLabel: { flex: 1, fontSize: fontSize(13), color: '#64748B', fontWeight: '600' },
  scheduleValue: { fontSize: fontSize(13), fontWeight: '700', color: '#1E293B' },
  previewText: {
    marginTop: hp(12),
    fontSize: fontSize(12),
    color: '#64748B',
    fontWeight: '600',
  },
  calculatingRow: { flexDirection: 'row', alignItems: 'center', gap: wp(10) },
  calculatingText: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
  calcErrorText: { fontSize: fontSize(14), color: '#DC2626', fontWeight: '600' },
  disabledButton: { opacity: 0.45 },
});
