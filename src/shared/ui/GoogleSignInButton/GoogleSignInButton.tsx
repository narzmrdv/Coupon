import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLanguage, useGoogleAuth } from '../../lib/hooks';
import { signInWithGoogle } from '../../lib/auth/googleAuth';
import { wp, hp, fontSize } from '../../lib/responsive';

/**
 * Self-contained — owns the whole tap-to-signed-in flow (native picker,
 * backend exchange, auth-state update). Drop it into Login/Register with no
 * extra wiring; RootNavigator picks up the auth-state change on its own,
 * same as after a normal email/password login.
 */
export const GoogleSignInButton: React.FC = () => {
  const { t } = useLanguage();
  const googleAuthMutation = useGoogleAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handlePress = async () => {
    if (signingIn || googleAuthMutation.isPending) return;
    setSigningIn(true);
    try {
      const result = await signInWithGoogle();
      switch (result.status) {
        case 'success':
          await googleAuthMutation.mutateAsync({ idToken: result.idToken });
          break;
        case 'cancelled':
          break; // user backed out of the picker — nothing to show
        case 'play-services-unavailable':
          Alert.alert(t.common.error, t.auth.google.playServicesUnavailable);
          break;
        case 'error':
          // The native picker succeeded (that part is basically never the
          // cause once it opens) — this is a Google-SDK-level failure after
          // the fact, so show its real message instead of a blanket string.
          Alert.alert(t.common.error, result.message || t.auth.google.signInFailed);
          break;
      }
    } catch (error: any) {
      // Most likely candidate when the picker opened fine: the backend
      // /auth/google exchange itself failed — surface the real HTTP error
      // instead of a generic "try again" that hides what actually broke.
      const detail = [error?.message, error?.requestUrl].filter(Boolean).join(' — ');
      Alert.alert(t.common.error, detail || t.auth.google.signInFailed);
    } finally {
      setSigningIn(false);
    }
  };

  const isBusy = signingIn || googleAuthMutation.isPending;

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t.auth.google.orDivider}</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.8}
        disabled={isBusy}
        onPress={() => void handlePress()}>
        {isBusy ? (
          <ActivityIndicator color="#1E293B" />
        ) : (
          <>
            <View style={styles.googleG}>
              <Text style={styles.googleGText}>G</Text>
            </View>
            <Text style={styles.buttonText}>{t.auth.google.continueWith}</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: hp(18) },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: {
    marginHorizontal: wp(12),
    fontSize: fontSize(13),
    color: '#94A3B8',
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: hp(56),
    borderRadius: wp(16),
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: wp(10),
  },
  googleG: {
    width: wp(22),
    height: wp(22),
    borderRadius: wp(11),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: { fontSize: fontSize(14), fontWeight: '800', color: '#0EA5E9' },
  buttonText: { fontSize: fontSize(16), fontWeight: '700', color: '#1E293B' },
});
