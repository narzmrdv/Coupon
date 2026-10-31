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
import { Input } from '../../shared/ui/Input/Input';
import { useLanguage, useResetPassword, useRequestPasswordReset } from '../../shared/lib/hooks';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { OtpCodeInput } from '../../shared/ui/OtpCodeInput/OtpCodeInput';
import { wp, hp, fontSize, responsive } from '../../shared/lib/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordScreen({ route }: Props) {
  const { email } = route.params;
  const { t } = useLanguage();
  const resetMutation = useResetPassword();
  const resendMutation = useRequestPasswordReset();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};

    if (code.length !== CODE_LENGTH) {
      newErrors.code = t.auth.resetPassword.errors.codeRequired;
    }
    if (!newPassword) {
      newErrors.newPassword = t.auth.resetPassword.errors.passwordRequired;
    } else if (newPassword.length < 6) {
      newErrors.newPassword = t.auth.resetPassword.errors.passwordMinLength;
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = t.auth.resetPassword.errors.confirmPasswordRequired;
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t.auth.resetPassword.errors.passwordMismatch;
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      await resetMutation.mutateAsync({ email, code, newPassword });
      // RootNavigator switches to MainStack on its own once it sees the
      // auth-token query flip to true (same as after a normal login).
    } catch {
      setCode('');
      setErrors({ code: t.auth.resetPassword.errors.codeInvalid });
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendMutation.isPending) return;
    try {
      await resendMutation.mutateAsync({ email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(t.common.success, t.auth.resetPassword.resendSuccess);
    } catch {
      Alert.alert(t.common.error, t.auth.resetPassword.resendError);
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
            <Text style={styles.title}>{t.auth.resetPassword.title}</Text>
            <Text style={styles.subtitle}>
              {t.auth.resetPassword.subtitle} <Text style={styles.emailText}>{email}</Text>
            </Text>
          </View>

          <View style={styles.formContainer}>
            <OtpCodeInput
              ref={codeInputRef}
              value={code}
              onChange={(v) => {
                setCode(v);
                setErrors((prev) => ({ ...prev, code: undefined }));
              }}
              length={CODE_LENGTH}
              error={!!errors.code}
            />
            {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}

            <View style={styles.spacer} />

            <Input
              label={t.auth.resetPassword.newPassword}
              placeholder={t.auth.resetPassword.newPasswordPlaceholder}
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                setErrors((prev) => ({ ...prev, newPassword: undefined }));
              }}
              error={errors.newPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Input
              label={t.auth.resetPassword.confirmPassword}
              placeholder={t.auth.resetPassword.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {resetMutation.isPending ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.submitButton}
                activeOpacity={0.8}
                onPress={() => void handleSubmit()}>
                <Text style={styles.submitButtonText}>{t.auth.resetPassword.submit}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.resendButton}
              disabled={cooldown > 0 || resendMutation.isPending}
              onPress={() => void handleResend()}>
              <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
                {cooldown > 0
                  ? t.auth.resetPassword.resendIn.replace('{seconds}', String(cooldown))
                  : t.auth.resetPassword.resend}
              </Text>
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
  header: { marginBottom: hp(32), alignItems: 'center' },
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
  spacer: { height: hp(8) },
  errorText: {
    color: '#EF4444',
    fontSize: fontSize(13),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: hp(4),
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
});
