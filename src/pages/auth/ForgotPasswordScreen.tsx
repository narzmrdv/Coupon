import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/AuthStack';
import { Input } from '../../shared/ui/Input/Input';
import { Button } from '../../shared/ui/Button/Button';
import { useLanguage, useRequestPasswordReset } from '../../shared/lib/hooks';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { wp, hp, fontSize, responsive } from '../../shared/lib/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const requestResetMutation = useRequestPasswordReset();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async () => {
    if (!email) {
      setError(t.auth.forgotPassword.errors.emailRequired);
      return;
    }
    if (!validateEmail(email)) {
      setError(t.auth.forgotPassword.errors.emailInvalid);
      return;
    }
    setError(undefined);
    try {
      await requestResetMutation.mutateAsync({ email });
      navigation.replace('ResetPassword', { email });
    } catch {
      Alert.alert(t.common.error, t.auth.forgotPassword.requestError);
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
            <Text style={styles.title}>{t.auth.forgotPassword.title}</Text>
            <Text style={styles.subtitle}>{t.auth.forgotPassword.subtitle}</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              label={t.auth.login.email}
              placeholder={t.auth.login.emailPlaceholder}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError(undefined);
              }}
              error={error}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            {requestResetMutation.isPending ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <Button title={t.auth.forgotPassword.submit} onPress={() => void handleSubmit()} />
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.footerText}>{t.auth.forgotPassword.backToLogin}</Text>
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
    paddingHorizontal: wp(12),
  },
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
  loadingButton: {
    height: hp(56),
    borderRadius: wp(16),
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  footer: { alignItems: 'center', paddingTop: hp(8) },
  footerText: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
});
