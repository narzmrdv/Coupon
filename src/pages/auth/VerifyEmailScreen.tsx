import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/AuthStack';
import { useLanguage, useVerifyEmail, useResendVerificationCode } from '../../shared/lib/hooks';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { OtpCodeInput } from '../../shared/ui/OtpCodeInput/OtpCodeInput';
import { wp, hp, fontSize, responsive } from '../../shared/lib/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { t } = useLanguage();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerificationCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (submittedCode: string) => {
    if (submittedCode.length !== CODE_LENGTH) {
      setError(t.auth.verifyEmail.errors.codeRequired);
      return;
    }
    setError(undefined);
    try {
      await verifyMutation.mutateAsync({ email, code: submittedCode });
      // RootNavigator switches to MainStack on its own once it sees the
      // auth-token query flip to true (same as after a normal login).
    } catch {
      setCode('');
      setError(t.auth.verifyEmail.errors.codeInvalid);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendMutation.isPending) return;
    try {
      await resendMutation.mutateAsync({ email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(t.common.success, t.auth.verifyEmail.resendSuccess);
    } catch {
      Alert.alert(t.common.error, t.auth.verifyEmail.resendError);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <AirplaneBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.verifyEmail.title}</Text>
            <Text style={styles.subtitle}>
              {t.auth.verifyEmail.subtitle} <Text style={styles.emailText}>{email}</Text>
            </Text>
          </View>

          <View style={styles.formContainer}>
            <OtpCodeInput
              ref={inputRef}
              value={code}
              onChange={(v) => {
                setCode(v);
                setError(undefined);
              }}
              onComplete={(v) => void handleVerify(v)}
              length={CODE_LENGTH}
              error={!!error}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {verifyMutation.isPending ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.submitButton}
                activeOpacity={0.8}
                onPress={() => void handleVerify(code)}>
                <Text style={styles.submitButtonText}>{t.auth.verifyEmail.submit}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.resendButton}
              disabled={cooldown > 0 || resendMutation.isPending}
              onPress={() => void handleResend()}>
              <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
                {cooldown > 0
                  ? t.auth.verifyEmail.resendIn.replace('{seconds}', String(cooldown))
                  : t.auth.verifyEmail.resend}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.replace('Register')}>
              <Text style={styles.footerText}>{t.auth.verifyEmail.changeEmail}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingHorizontal: wp(20), paddingVertical: hp(40) },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: { marginBottom: hp(40), alignItems: 'center' },
  title: {
    fontSize: responsive({ xs: fontSize(26), sm: fontSize(30), default: fontSize(32) }),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(12),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize(15),
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  emailText: { color: '#0EA5E9', fontWeight: '700' },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(24),
    padding: wp(28),
    marginBottom: hp(28),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: fontSize(13),
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: hp(12),
  },
  submitButton: {
    height: hp(56),
    borderRadius: wp(16),
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(8),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: fontSize(16) },
  loadingButton: {
    height: hp(56),
    borderRadius: wp(16),
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(8),
    opacity: 0.8,
  },
  resendButton: { alignItems: 'center', marginTop: hp(20) },
  resendText: { fontSize: fontSize(14), fontWeight: '600', color: '#0EA5E9' },
  resendTextDisabled: { color: '#94A3B8' },
  footer: { alignItems: 'center', paddingTop: hp(8) },
  footerText: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
});
