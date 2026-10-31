import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage, useBonus } from '@/shared/lib/hooks';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/MainStack';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';
import { ScreenErrorBoundary } from '@/shared/ui/ScreenErrorBoundary';
import { TwaRewardsGrid } from '@/features/twa-rewards/ui/TwaRewardsGrid';
import { AdBanner } from '@/features/ads/ui/AdBanner';
import { formatTwaAmount } from '@/shared/constants/adRewards';
import { wp, hp, fontSize } from '@/shared/lib/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_LABELS: Record<string, { title: string; subtitle: string }> = {
  ru: { title: 'Потратьте бонусы', subtitle: 'Выберите награду по душе' },
  en: { title: 'Spend bonuses',    subtitle: 'Choose a reward for your soul' },
  uk: { title: 'Витратьте бонуси', subtitle: 'Оберіть нагороду до душі' },
};

export const BonusShopScreen = () => (
  <ScreenErrorBoundary>
    <BonusShopScreenBody />
  </ScreenErrorBoundary>
);

const BonusShopScreenBody = () => {
  const { t, language } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { balance, loading, fetchBalance } = useBonus();
  const userBalance = balance?.available ?? 0;

  useFocusEffect(
    useCallback(() => {
      void fetchBalance();
    }, [fetchBalance]),
  );

  const hero = HERO_LABELS[language] ?? HERO_LABELS.ru;

  if (loading && !balance) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AirplaneBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t.bonusShop.title}</Text>

        <View style={styles.balanceChip}>
          <Text style={styles.balancePlane}>✈</Text>
          <Text style={styles.balanceText}>{formatTwaAmount(userBalance)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.scroll}>

        {/* ── Hero Card ── */}
        <LinearGradient
          colors={['#EFF6FF', '#DBEAFE', '#BFDBFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}>

          {/* Logo circle */}
          <View style={styles.logoCircleOuter}>
            <View style={styles.logoCircleInner}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Text */}
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
          </View>

          {/* Star */}
          <Star size={wp(32)} color="#0EA5E9" fill="#0EA5E9" strokeWidth={0} />
        </LinearGradient>

        {/* ── Rewards Grid ── */}
        <View style={styles.gridSection}>
          <TwaRewardsGrid
            balance={userBalance}
            onBalanceChange={() => void fetchBalance()}
          />
        </View>

        {/* ── Banner Ad ── */}
        <View style={styles.adSlot}>
          <AdBanner />
        </View>

        <View style={{ height: hp(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    width: wp(40),
    height: wp(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    borderRadius: wp(20),
    gap: wp(5),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  balancePlane: {
    fontSize: fontSize(14),
    color: '#0EA5E9',
  },
  balanceText: {
    fontSize: fontSize(13),
    fontWeight: '700',
    color: '#0EA5E9',
  },

  // Without flex:1 here, the ScrollView sizes to its content instead of
  // being bounded by the remaining screen height — that's what made
  // scrolling unreliable ("works sometimes, not others").
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: wp(16),
    paddingTop: hp(4),
  },

  // ── Hero Card ──
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: wp(20),
    paddingVertical: hp(16),
    paddingHorizontal: wp(16),
    marginBottom: hp(24),
    gap: wp(12),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  logoCircleOuter: {
    width: wp(60),
    height: wp(60),
    borderRadius: wp(30),
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoCircleInner: {
    width: wp(50),
    height: wp(50),
    borderRadius: wp(25),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: wp(40),
    height: wp(40),
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(3),
  },
  heroSubtitle: {
    fontSize: fontSize(13),
    color: '#64748B',
    lineHeight: fontSize(18),
  },

  // ── Grid ──
  gridSection: {
    marginBottom: hp(8),
  },

  adSlot: {
    marginTop: hp(8),
    alignItems: 'center',
  },
});
