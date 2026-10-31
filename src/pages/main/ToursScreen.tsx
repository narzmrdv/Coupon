import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Umbrella, Pyramid, Building2, Palmtree, Waves, Check, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '@/shared/lib/hooks';
import { wp, hp, fontSize, responsive } from '@/shared/lib/responsive';

const tours = [
  {
    id: '1',
    title: 'Турция, Анталья',
    hotel: 'Sunrise Resort 5★',
    duration: '7 ночей',
    price: 15000,
    originalPrice: 45000,
    icon: 'beach',
    tagKey: 'popular',
  },
  {
    id: '2',
    title: 'Египет, Шарм-эль-Шейх',
    hotel: 'Rixos Premium 5★',
    duration: '7 ночей',
    price: 20000,
    originalPrice: 65000,
    icon: 'pyramid',
    tagKey: 'hotTour',
  },
  {
    id: '3',
    title: 'ОАЭ, Дубай',
    hotel: 'Atlantis The Palm 5★',
    duration: '5 ночей',
    price: 35000,
    originalPrice: 120000,
    icon: 'city',
    tagKey: null,
  },
  {
    id: '4',
    title: 'Таиланд, Пхукет',
    hotel: 'Kata Beach Resort 4★',
    duration: '10 ночей',
    price: 25000,
    originalPrice: 80000,
    icon: 'palm',
    tagKey: 'new',
  },
  {
    id: '5',
    title: 'Мальдивы',
    hotel: 'Soneva Fushi 5★',
    duration: '7 ночей',
    price: 50000,
    originalPrice: 200000,
    icon: 'waves',
    tagKey: null,
  },
];

const TourIcon = ({ type }: { type: string }) => {
  const iconSize = responsive({ xs: 40, sm: 44, default: 48 });
  const iconProps = { size: iconSize, strokeWidth: 1.5, color: '#0EA5E9' };
  switch (type) {
    case 'beach':
      return <Umbrella {...iconProps} />;
    case 'pyramid':
      return <Pyramid {...iconProps} />;
    case 'city':
      return <Building2 {...iconProps} />;
    case 'palm':
      return <Palmtree {...iconProps} />;
    case 'waves':
      return <Waves {...iconProps} />;
    default:
      return <Umbrella {...iconProps} />;
  }
};

export const ToursScreen = () => {
  const { t } = useLanguage();
  const userBalance = 2450;

  const categories = [
    t.main.tours.all,
    t.main.tours.beach,
    t.main.tours.excursions,
    t.main.tours.mountains,
    t.main.tours.islands,
  ];

  const getTagLabel = (tagKey: string | null) => {
    if (!tagKey) return null;
    const tags: Record<string, string> = {
      popular: t.main.tours.popular,
      hotTour: t.main.tours.hotTour,
      new: t.main.tours.new,
    };
    return tags[tagKey] || tagKey;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.main.tours.title}</Text>
          <View style={styles.balanceChip}>
            <Text style={styles.balanceChipText}>{userBalance.toLocaleString()}</Text>
          </View>
        </View>

        {/* Featured Banner */}
        <View style={styles.bannerSection}>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={['#EC4899', '#DB2777', '#BE185D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featuredBanner}>
              <View style={styles.bannerContent}>
                <View style={styles.bannerLeft}>
                  <Text style={styles.bannerTitle}>{t.main.tours.hotDeals}</Text>
                  <Text style={styles.bannerSubtitle}>{t.main.tours.specialDiscount} 70%</Text>
                </View>
                <View style={styles.bannerIcon}>
                  <Star size={wp(40)} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}>
          {categories.map((cat, index) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, index === 0 && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, index === 0 && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tours List */}
        <View style={styles.toursList}>
          {tours.map((tour) => {
            const canAfford = userBalance >= tour.price;
            const progress = Math.min((userBalance / tour.price) * 100, 100);

            return (
              <TouchableOpacity key={tour.id} style={styles.tourCard} activeOpacity={0.8}>
                {/* Image placeholder */}
                <View style={styles.tourImage}>
                  <TourIcon type={tour.icon} />
                  {tour.tagKey && (
                    <View style={styles.tourTag}>
                      <Text style={styles.tourTagText}>{getTagLabel(tour.tagKey)}</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={styles.tourInfo}>
                  <Text style={styles.tourTitle}>{tour.title}</Text>
                  <Text style={styles.tourHotel}>{tour.hotel}</Text>
                  <Text style={styles.tourDuration}>{tour.duration}</Text>

                  {/* Price */}
                  <View style={styles.priceRow}>
                    <View>
                      <Text style={styles.tourPrice}>
                        {tour.price.toLocaleString()} {t.main.tours.points}
                      </Text>
                      <Text style={styles.tourOriginalPrice}>
                        {t.main.tours.normalPrice}: {tour.originalPrice.toLocaleString()}
                      </Text>
                    </View>
                    {canAfford ? (
                      <View style={styles.affordBadge}>
                        <View style={styles.affordBadgeContent}>
                          <Text style={styles.affordBadgeText}>{t.main.tours.available}</Text>
                          <Check size={wp(14)} color="#16A34A" strokeWidth={3} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>{Math.round(progress)}%</Text>
                      </View>
                    )}
                  </View>

                  {/* Progress bar */}
                  {!canAfford && (
                    <View style={styles.tourProgress}>
                      <View style={styles.tourProgressBar}>
                        <View style={[styles.tourProgressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.tourProgressText}>
                        {(tour.price - userBalance).toLocaleString()} {t.main.tours.pointsLeft}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: hp(140) }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(20),
    paddingTop: hp(16),
    paddingBottom: hp(12),
  },
  headerTitle: {
    fontSize: fontSize(28),
    fontWeight: '700',
    color: '#1E293B',
  },
  balanceChip: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
    borderRadius: wp(20),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceChipText: {
    color: '#FFFFFF',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  bannerSection: {
    paddingHorizontal: wp(20),
    paddingTop: hp(8),
    paddingBottom: hp(12),
  },
  featuredBanner: {
    width: '100%',
    minHeight: hp(120),
    borderRadius: wp(20),
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(24),
    paddingVertical: hp(20),
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: fontSize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(4),
  },
  bannerSubtitle: {
    fontSize: fontSize(15),
    color: '#FFFFFF',
    opacity: 0.95,
    fontWeight: '600',
  },
  bannerIcon: {
    width: wp(64),
    height: wp(64),
    borderRadius: wp(32),
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    paddingHorizontal: wp(20),
    paddingBottom: hp(20),
    gap: wp(10),
  },
  categoryChip: {
    paddingHorizontal: wp(18),
    paddingVertical: hp(10),
    borderRadius: wp(20),
    backgroundColor: '#FFFFFF',
    marginRight: wp(10),
  },
  categoryChipActive: {
    backgroundColor: '#0EA5E9',
  },
  categoryText: {
    fontSize: fontSize(14),
    fontWeight: '500',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  toursList: {
    paddingHorizontal: wp(20),
  },
  tourCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    marginBottom: hp(16),
    overflow: 'hidden',
  },
  tourImage: {
    height: hp(160),
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tourTag: {
    position: 'absolute',
    top: hp(12),
    left: wp(12),
    backgroundColor: '#0EA5E9',
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(8),
  },
  tourTagText: {
    color: '#FFFFFF',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  tourInfo: {
    padding: wp(18),
  },
  tourTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: hp(4),
  },
  tourHotel: {
    fontSize: fontSize(14),
    color: '#64748B',
    marginBottom: hp(2),
  },
  tourDuration: {
    fontSize: fontSize(13),
    color: '#94A3B8',
    marginBottom: hp(14),
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tourPrice: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#0EA5E9',
    marginBottom: hp(2),
  },
  tourOriginalPrice: {
    fontSize: fontSize(12),
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  affordBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(8),
  },
  affordBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  affordBadgeText: {
    color: '#16A34A',
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  progressBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(8),
  },
  progressBadgeText: {
    color: '#B45309',
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  tourProgress: {
    marginTop: hp(14),
  },
  tourProgressBar: {
    height: hp(6),
    backgroundColor: '#E2E8F0',
    borderRadius: wp(3),
    marginBottom: hp(8),
  },
  tourProgressFill: {
    height: hp(6),
    backgroundColor: '#0EA5E9',
    borderRadius: wp(3),
  },
  tourProgressText: {
    fontSize: fontSize(12),
    color: '#64748B',
  },
});
