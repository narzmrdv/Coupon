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
import { useLanguage, useLogin } from '../../shared/lib/hooks';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { GoogleSignInButton } from '../../shared/ui/GoogleSignInButton/GoogleSignInButton';
import { wp, hp, fontSize, responsive } from '../../shared/lib/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const loginMutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = t.auth.login.errors.emailRequired;
    } else if (!validateEmail(email)) {
      newErrors.email = t.auth.login.errors.emailInvalid;
    }

    if (!password) {
      newErrors.password = t.auth.login.errors.passwordRequired;
    } else if (password.length < 6) {
      newErrors.password = t.auth.login.errors.passwordMinLength;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        if (__DEV__) console.log('[LoginScreen] Logging in with:', { email });
        await loginMutation.mutateAsync({ email, password });
        if (__DEV__) console.log('[LoginScreen] Login successful');
        // RootNavigator автоматически переведет на MainStack когда увидит токен
      } catch (error: any) {
        if (__DEV__) console.error('[LoginScreen] Login error:', error);
        // Right password, but the account never finished email verification —
        // send them to finish it instead of just showing an error they can't
        // act on (the backend signals this with 403, not the usual 401).
        if (error?.statusCode === 403) {
          navigation.navigate('VerifyEmail', { email });
          return;
        }
        // Never surface the raw backend/axios message here (e.g. "Request
        // failed with status code 401") — always a friendly, translated
        // message instead, regardless of what the server actually said.
        Alert.alert(t.common.error, t.auth.login.invalidCredentials);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <AirplaneBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.login.title}</Text>
            <Text style={styles.subtitle}>{t.auth.login.subtitle}</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Input
              label={t.auth.login.email}
              placeholder={t.auth.login.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label={t.auth.login.password}
              placeholder={t.auth.login.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotPasswordText}>{t.auth.login.forgotPassword}</Text>
            </TouchableOpacity>

            {loginMutation.isPending ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <Button title={t.auth.login.signIn} onPress={handleLogin} />
            )}

            <GoogleSignInButton />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerText}>
                {t.auth.login.noAccount}{' '}
                <Text style={styles.footerLink}>{t.auth.login.signUp}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp(20),
    paddingVertical: hp(40),
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: hp(40),
    alignItems: 'center',
  },
  title: {
    fontSize: responsive({ xs: fontSize(30), sm: fontSize(34), default: fontSize(36) }),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(12),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize(16),
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  languageButton: {
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(8),
    backgroundColor: '#E0F2FE',
  },
  languageText: {
    fontSize: fontSize(12),
    fontWeight: '600',
    color: '#0EA5E9',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: hp(20),
    marginTop: hp(-4),
  },
  forgotPasswordText: {
    color: '#0EA5E9',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  loadingButton: {
    height: hp(56),
    borderRadius: wp(12),
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: hp(8),
  },
  footerText: {
    fontSize: fontSize(15),
    color: '#64748B',
    textAlign: 'center',
  },
  footerLink: {
    color: '#0EA5E9',
    fontWeight: '700',
  },
});
