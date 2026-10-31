import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/MainStack';
import { useLanguage } from '@/shared/lib/hooks';
import { useBonus } from '@/shared/lib/hooks/useBonus';
import { paymentApi } from '@/shared/api/paymentApi';
import { wp, hp, fontSize } from '@/shared/lib/responsive';

// Must match returnUrl configured on backend
const RETURN_URL = 'https://twaio.net/payment-return';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PaymentWebView'>;
type RouteProps = RouteProp<RootStackParamList, 'PaymentWebView'>;

type ResultState = 'pending' | 'checking' | 'success' | 'failure';

const LABELS = {
  ru: {
    title: 'Оплата',
    checking: 'Проверяем оплату...',
    checkingSub: 'Подождите, это займёт несколько секунд',
    success: 'Платёж прошёл!',
    successSub: 'TWA-бонусы начислены на ваш счёт',
    failure: 'Ошибка оплаты',
    failureSub: 'Платёж не прошёл. Если деньги списались — они вернутся автоматически или обратитесь в поддержку.',
    close: 'Закрыть',
    retry: 'Попробовать снова',
    checkStatus: 'Проверить статус',
  },
  en: {
    title: 'Payment',
    checking: 'Verifying payment...',
    checkingSub: 'Please wait, this takes a few seconds',
    success: 'Payment successful!',
    successSub: 'TWA bonuses have been credited to your account',
    failure: 'Payment failed',
    failureSub: 'Payment was not completed. If money was deducted, it will be refunded automatically or contact support.',
    close: 'Close',
    retry: 'Try again',
    checkStatus: 'Check status',
  },
  uk: {
    title: 'Оплата',
    checking: 'Перевіряємо оплату...',
    checkingSub: 'Зачекайте, це займе кілька секунд',
    success: 'Платіж пройшов!',
    successSub: 'TWA-бонуси нараховано на ваш рахунок',
    failure: 'Помилка оплати',
    failureSub: 'Платіж не пройшов. Якщо гроші списались — вони повернуться автоматично або зверніться до підтримки.',
    close: 'Закрити',
    retry: 'Спробувати знову',
    checkStatus: 'Перевірити статус',
  },
} as const;

export const PaymentWebViewScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { paymentUrl, orderReference } = route.params;
  const { language } = useLanguage();
  const { fetchBalance } = useBonus();
  const L = LABELS[language] ?? LABELS.ru;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ResultState>('pending');
  const webViewRef = useRef<WebView>(null);
  const processedRef = useRef(false);

  // Poll backend for actual payment status (webhook may take 1-3 sec to process)
  const checkStatusWithRetry = async (): Promise<ResultState> => {
    if (!orderReference) return 'failure';

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise<void>((r) => setTimeout(r, 2000));
        }
        const status = await paymentApi.getPaymentStatus(orderReference);
        console.log(`[Payment] attempt ${attempt + 1} status:`, status.transactionStatus);

        if (status.transactionStatus === 'Approved') return 'success';
        if (
          status.transactionStatus === 'Declined' ||
          status.transactionStatus === 'Expired' ||
          status.transactionStatus === 'Refunded'
        ) {
          return 'failure';
        }
        // 'Pending' → keep polling
      } catch (err) {
        console.warn(`[Payment] status check attempt ${attempt + 1} failed:`, err);
      }
    }
    // After ~14 seconds still pending → treat as failure
    return 'failure';
  };

  const handleReturnUrl = async () => {
    if (processedRef.current) return;
    processedRef.current = true;

    setResult('checking');
    const finalStatus = await checkStatusWithRetry();
    setResult(finalStatus);

    if (finalStatus === 'success') {
      void fetchBalance();
    }
  };

  // onShouldStartLoadWithRequest: fires before navigation (most reliable on both platforms)
  const handleShouldStartLoad = (request: { url: string }) => {
    if (request.url.startsWith(RETURN_URL)) {
      void handleReturnUrl();
      return false; // Block WebView from loading the return page
    }
    return true;
  };

  // Fallback: onNavigationStateChange (catches redirects missed by onShouldStartLoad)
  const handleNavigationChange = (navState: WebViewNavigation) => {
    const url = navState.url ?? '';
    if (url.startsWith(RETURN_URL)) {
      void handleReturnUrl();
    }
  };

  const handleCheckStatus = async () => {
    processedRef.current = false; // Allow re-check
    await handleReturnUrl();
  };

  const handleClose = () => {
    void fetchBalance(); // Always refresh balance on close
    navigation.goBack();
  };

  // ── Checking screen ──
  if (result === 'checking') {
    return (
      <SafeAreaView style={styles.resultContainer} edges={['top', 'bottom']}>
        <View style={styles.resultContent}>
          <ActivityIndicator size="large" color="#0EA5E9" style={{ marginBottom: hp(24) }} />
          <Text style={styles.resultTitle}>{L.checking}</Text>
          <Text style={styles.resultSub}>{L.checkingSub}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success / Failure screen ──
  if (result !== 'pending') {
    const isSuccess = result === 'success';
    return (
      <SafeAreaView style={styles.resultContainer} edges={['top', 'bottom']}>
        <View style={styles.resultContent}>
          {isSuccess ? (
            <CheckCircle size={wp(80)} color="#10B981" strokeWidth={1.5} />
          ) : (
            <XCircle size={wp(80)} color="#EF4444" strokeWidth={1.5} />
          )}
          <Text style={[styles.resultTitle, !isSuccess && styles.resultTitleError]}>
            {isSuccess ? L.success : L.failure}
          </Text>
          <Text style={styles.resultSub}>
            {isSuccess ? L.successSub : L.failureSub}
          </Text>
        </View>
        <View style={styles.resultButtons}>
          {!isSuccess && (
            <>
              <TouchableOpacity
                style={styles.checkStatusBtn}
                onPress={() => void handleCheckStatus()}
                activeOpacity={0.8}>
                <Clock size={wp(18)} color="#0EA5E9" strokeWidth={2} />
                <Text style={styles.checkStatusBtnText}>{L.checkStatus}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { processedRef.current = false; setResult('pending'); }}
                activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>{L.retry}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>{L.close}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── WebView screen ──
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{L.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: paymentUrl }}
        style={styles.webView}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationChange}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        mixedContentMode="compatibility"
      />

      {loading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: wp(40),
    height: wp(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: wp(20),
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSpacer: {
    width: wp(40),
  },
  webView: {
    flex: 1,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248,250,252,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Result screens
  resultContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
    paddingHorizontal: wp(24),
    paddingVertical: hp(40),
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(16),
  },
  resultTitle: {
    fontSize: fontSize(26),
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  resultTitleError: {
    color: '#EF4444',
  },
  resultSub: {
    fontSize: fontSize(14),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: fontSize(20),
    maxWidth: '85%',
  },
  resultButtons: {
    gap: hp(12),
  },
  checkStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    backgroundColor: '#EFF6FF',
    borderRadius: wp(16),
    paddingVertical: hp(16),
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
  },
  checkStatusBtnText: {
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#0EA5E9',
  },
  retryBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: wp(16),
    paddingVertical: hp(16),
    alignItems: 'center',
  },
  retryBtnText: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    paddingVertical: hp(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeBtnText: {
    fontSize: fontSize(16),
    fontWeight: '600',
    color: '#64748B',
  },
});
