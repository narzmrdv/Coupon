import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, CreditCard, Plane, ShieldCheck } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/app/navigation/MainStack';
import { tourService } from '@/entities/tour/model/tourService';
import { majorToMinor, minorToInputValue, parseMoneyToMinor } from '@/features/installment/lib/money';
import { useLanguage } from '@/shared/lib/hooks';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TourPayment'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'TourPayment'>;

export const TourPaymentScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { t } = useLanguage();
  const copy = t.main.installment;

  const initialMinor = route.params?.amount ? majorToMinor(route.params.amount) : null;
  const [amountInput, setAmountInput] = useState(
    initialMinor ? minorToInputValue(initialMinor) : '',
  );
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);

  const baseAmount = useMemo(() => parseMoneyToMinor(amountInput), [amountInput]);
  const isValid = baseAmount !== null && baseAmount > 0;

  const handlePay = async () => {
    if (!isValid || baseAmount === null || payingRef.current) return;

    payingRef.current = true;
    setPaying(true);
    try {
      const { paymentUrl, orderReference } = await tourService.payForTour({
        tourId: route.params?.tourId,
        baseAmount,
      });
      navigation.replace('PaymentWebView', { paymentUrl, orderReference });
    } catch (error: any) {
      Alert.alert(t.common.error, error?.error || error?.message || copy.tourPaymentError);
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.payTourTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Plane size={30} color="#FFFFFF" strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>{copy.payTourIntroTitle}</Text>
            <Text style={styles.heroText}>{copy.payTourIntroText}</Text>
          </View>

          {/* Amount input */}
          <Text style={styles.sectionTitle}>{copy.payTourAmountLabel}</Text>
          <View style={styles.amountCard}>
            <Text style={styles.currencySign}>€</Text>
            <TextInput
              style={styles.amountInput}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
          {amountInput.length > 0 && !isValid ? (
            <Text style={styles.amountErrorText}>{copy.amountError}</Text>
          ) : null}

          {/* Payment method */}
          <Text style={styles.sectionTitle}>{copy.payTourMethodLabel}</Text>
          <View style={styles.methodCard}>
            <View style={styles.methodIconBox}>
              <CreditCard size={wp(22)} color="#0EA5E9" strokeWidth={2} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>WayForPay</Text>
              <Text style={styles.methodSub}>Visa, Mastercard</Text>
            </View>
            <View style={styles.checkCircle}>
              <Check size={wp(14)} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>

          {/* Info notice */}
          <View style={styles.noticeCard}>
            <ShieldCheck size={20} color="#0369A1" strokeWidth={2} />
            <Text style={styles.noticeText}>{copy.payTourNotice}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payButton, (!isValid || paying) && styles.payButtonDisabled]}
          activeOpacity={0.85}
          disabled={!isValid || paying}
          onPress={() => void handlePay()}>
          {paying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.payButtonText}>{copy.payTourButton}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  content: { padding: wp(16), paddingBottom: hp(140) },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: wp(22),
    padding: wp(24),
    marginBottom: hp(24),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroIcon: {
    width: wp(56),
    height: wp(56),
    borderRadius: wp(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: hp(12),
  },
  heroTitle: {
    fontSize: fontSize(19),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroText: {
    marginTop: hp(6),
    fontSize: fontSize(13),
    lineHeight: fontSize(19),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    maxWidth: '90%',
  },
  sectionTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(12),
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(18),
    borderWidth: 2,
    borderColor: '#0EA5E9',
    paddingHorizontal: wp(18),
    marginBottom: hp(6),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  currencySign: {
    fontSize: fontSize(26),
    fontWeight: '800',
    color: '#0EA5E9',
    marginRight: wp(10),
  },
  amountInput: {
    flex: 1,
    fontSize: fontSize(28),
    fontWeight: '800',
    color: '#1E293B',
    paddingVertical: hp(16),
  },
  amountErrorText: {
    fontSize: fontSize(13),
    color: '#EF4444',
    fontWeight: '500',
    marginBottom: hp(10),
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    marginTop: hp(24),
    marginBottom: hp(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  methodIconBox: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(12),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(14),
  },
  methodInfo: { flex: 1 },
  methodName: { fontSize: fontSize(15), fontWeight: '600', color: '#1E293B', marginBottom: hp(2) },
  methodSub: { fontSize: fontSize(13), color: '#94A3B8' },
  checkCircle: {
    width: wp(26),
    height: wp(26),
    borderRadius: wp(13),
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(10),
    backgroundColor: '#F0F9FF',
    borderRadius: wp(16),
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: wp(16),
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize(13),
    lineHeight: fontSize(19),
    color: '#0369A1',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(28),
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  payButton: {
    backgroundColor: '#38BDF8',
    borderRadius: wp(16),
    paddingVertical: hp(18),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: fontSize(17), fontWeight: '700', color: '#FFFFFF' },
});
