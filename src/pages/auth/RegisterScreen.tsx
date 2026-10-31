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
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/AuthStack';
import { Input } from '../../shared/ui/Input/Input';
import { Button } from '../../shared/ui/Button/Button';
import { useLanguage, useRegister } from '../../shared/lib/hooks';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { GoogleSignInButton } from '../../shared/ui/GoogleSignInButton/GoogleSignInButton';
import { wp, hp, fontSize, responsive } from '../../shared/lib/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const registerMutation = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = t.auth.register.errors.emailRequired;
    } else if (!validateEmail(email)) {
      newErrors.email = t.auth.register.errors.emailInvalid;
    }

    if (!password) {
      newErrors.password = t.auth.register.errors.passwordRequired;
    } else if (password.length < 6) {
      newErrors.password = t.auth.register.errors.passwordMinLength;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t.auth.register.errors.confirmPasswordRequired;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t.auth.register.errors.passwordMismatch;
    }

    if (!acceptedTerms) {
      newErrors.terms = t.auth.register.errors.termsNotAccepted;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const registeredEmail = email;
      try {
        if (__DEV__) console.log('[RegisterScreen] Submitting registration for:', email);
        await registerMutation.mutateAsync({ email, password });
        if (__DEV__) console.log('[RegisterScreen] Registration successful, code sent');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAcceptedTerms(false);
        setErrors({});
        navigation.replace('VerifyEmail', { email: registeredEmail });
      } catch (error: any) {
        if (__DEV__) console.error('[RegisterScreen] Registration error:', error);
        // Never surface the raw backend/axios message — always a friendly,
        // translated message instead.
        const statusCode = error?.statusCode ?? error?.status;
        const message =
          statusCode === 409 ? t.auth.register.emailTaken : t.common.registrationFailed;
        Alert.alert(t.common.error, message);
      }
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://docs.google.com/document/d/e/2PACX-1vSm-2sKp-AFV-FljRS_0n6DWE61HY6YrEOYhsOF1FdGPdukOG9cWq0n0B3B2Egi3-7aam1oTgn3vXqs/pub');
  };

  const openTermsOfUse = () => {
    Linking.openURL('https://twa.su/terms');
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
            <Text style={styles.title}>{t.auth.register.title}</Text>
            <Text style={styles.subtitle}>{t.auth.register.subtitle}</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Input
              label={t.auth.register.email}
              placeholder={t.auth.register.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label={t.auth.register.password}
              placeholder={t.auth.register.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />

            <Input
              label={t.auth.register.confirmPassword}
              placeholder={t.auth.register.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />

            {/* Terms and Conditions Checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}>
              <View style={[styles.checkbox, acceptedTerms ? styles.checkboxChecked : null]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.termsTextContainer}>
                <Text style={styles.termsText}>
                  {t.auth.register.agreeToTerms}{' '}
                  <Text style={styles.termsLink} onPress={openPrivacyPolicy}>
                    {t.auth.register.privacyPolicy}
                  </Text>{' '}
                  {t.auth.register.and}{' '}
                  <Text style={styles.termsLink} onPress={openTermsOfUse}>
                    {t.auth.register.termsOfUse}
                  </Text>
                </Text>
              </View>
            </TouchableOpacity>
            {errors.terms ? <Text style={styles.termsError}>{errors.terms}</Text> : null}

            {registerMutation.isPending ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <Button title={t.auth.register.signUp} onPress={handleRegister} />
            )}

            <GoogleSignInButton />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerText}>
                {t.auth.register.haveAccount}{' '}
                <Text style={styles.footerLink}>{t.auth.register.signIn}</Text>
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
  loadingButton: {
    height: hp(56),
    borderRadius: wp(12),
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(16),
    paddingHorizontal: wp(4),
  },
  checkbox: {
    width: wp(22),
    height: wp(22),
    borderRadius: wp(6),
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(12),
    marginTop: hp(2),
  },
  checkboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  termsTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  termsText: {
    fontSize: fontSize(13),
    color: '#64748B',
    lineHeight: fontSize(18),
    flexWrap: 'wrap',
  },
  termsLink: {
    color: '#0EA5E9',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsError: {
    fontSize: fontSize(12),
    color: '#EF4444',
    marginTop: hp(-12),
    marginBottom: hp(12),
    paddingHorizontal: wp(4),
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
