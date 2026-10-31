import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldOff } from 'lucide-react-native';
import { wp, hp, fontSize } from '@/shared/lib/responsive';

interface VpnRequiredScreenProps {
  onRetry: () => void;
  checking: boolean;
}

export const VpnRequiredScreen: React.FC<VpnRequiredScreenProps> = ({ onRetry, checking }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconBox}>
          <ShieldOff size={64} color="#EF4444" strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>VPN не обнаружен</Text>
        <Text style={styles.subtitle}>
          Для использования приложения необходимо подключиться к VPN.
        </Text>

        <View style={styles.steps}>
          <View style={styles.step}>
            <Text style={styles.stepNum}>1</Text>
            <Text style={styles.stepText}>Откройте приложение VPN на вашем устройстве</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>2</Text>
            <Text style={styles.stepText}>Подключитесь к серверу Германии, США или другой страны</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>3</Text>
            <Text style={styles.stepText}>Нажмите «Повторить» ниже</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, checking && styles.buttonDisabled]}
          onPress={onRetry}
          disabled={checking}
          activeOpacity={0.8}>
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Повторить</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(32),
  },
  iconBox: {
    width: wp(120),
    height: wp(120),
    borderRadius: wp(60),
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(28),
  },
  title: {
    fontSize: fontSize(26),
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: hp(12),
  },
  subtitle: {
    fontSize: fontSize(15),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: fontSize(22),
    marginBottom: hp(32),
  },
  steps: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    padding: wp(20),
    marginBottom: hp(32),
    gap: hp(16),
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(14),
  },
  stepNum: {
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
    backgroundColor: '#0EA5E9',
    color: '#FFFFFF',
    fontSize: fontSize(14),
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: wp(30),
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: fontSize(14),
    color: '#334155',
    lineHeight: fontSize(20),
  },
  button: {
    backgroundColor: '#0EA5E9',
    borderRadius: wp(14),
    paddingVertical: hp(16),
    paddingHorizontal: wp(48),
    minWidth: wp(200),
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
