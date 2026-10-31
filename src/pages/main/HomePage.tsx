import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  TextInput,
  useWindowDimensions,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Settings,
  Languages,
  Plane,
  User,
  Camera,
  Pencil,
  ChevronRight,
  ShoppingBag,
  Trophy,
  Facebook,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '@/shared/lib/api/apiClient';
import { API_CONFIG } from '@/shared/config/api';
import { useLanguage, useDeleteAccount, useBonus } from '../../shared/lib/hooks';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback, useState, useEffect } from 'react';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { AdBanner } from '@/features/ads/ui/AdBanner';
import { RewardedAdButton } from '@/features/ads/ui/RewardedAdButton';
import {
  wp,
  hp,
  fontSize,
  sizes,
  responsive,
  isSmallDevice,
  isTablet,
} from '../../shared/lib/responsive';

const WHEEL_TITLE: Record<string, string> = {
  ru: 'Колесо удачи',
  en: 'Wheel of Fortune',
  uk: 'Колесо удачі',
};

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/g/1JPvHcmJTq';

// buy_twa.png's own aspect ratio (coin icon + "TWA" baked in; "Buy" was
// erased from the graphic so it can be overlaid as translatable text).
const BUY_BUTTON_IMAGE_RATIO = 1822 / 544;

type MainTabParamList = {
  Home: undefined;
  Chat: undefined;
  Documents: undefined;
};

type RootStackParamList = {
  MainTabs: undefined;
  BonusShop: undefined;
  Settings: undefined;
  LuckyTicket: undefined;
  WheelOfFortune: undefined;
  MysteryBox: undefined;
  TopUp: undefined;
  InstallmentCalculator:
    | { tourId?: number; amount?: number }
    | undefined;
  InstallmentsList: undefined;
};

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export const HomePage = () => {
  const { t, language, setLanguage } = useLanguage();
  const deleteAccountMutation = useDeleteAccount();
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();
  const { balance, fetchBalance } = useBonus();
  const userBalance = balance?.available || 0;

  const [refreshing, setRefreshing] = useState(false);
  const DEFAULT_NICKNAME = language === 'en' ? 'User' : language === 'uk' ? 'Користувач' : 'Пользователь';
  const [nickname, setNickname] = useState(DEFAULT_NICKNAME);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  useEffect(() => {
    AsyncStorage.multiGet(['@profile_nickname', '@profile_avatar']).then((pairs) => {
      const nick = pairs[0][1];
      const avatar = pairs[1][1];
      if (nick) setNickname(nick);
      if (avatar) setAvatarUri(avatar);
    });
  }, []);

  // Saves locally for instant display AND uploads to the server so other
  // players can actually see it (e.g. in the Jackpot wheel) — avatars used
  // to be device-local only, which meant nobody else could ever see them.
  const persistAvatar = async (uri: string) => {
    setAvatarUri(uri);
    await AsyncStorage.setItem('@profile_avatar', uri);
    try {
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);
      const response = await apiClient.getInstance().post<{ url?: string; filename?: string }>(
        API_CONFIG.ENDPOINTS.BONUS.UPLOAD,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const uploadedUrl = response.data?.url;
      if (uploadedUrl) {
        await AsyncStorage.setItem('@profile_avatar_url', uploadedUrl);
      }
    } catch (error) {
      if (__DEV__) console.error('[HomePage] Failed to upload avatar:', error);
      // Not fatal — the avatar still shows locally, it just won't be
      // visible to other players until a retry succeeds.
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Фото профиля', 'Выберите источник', [
      {
        text: 'Галерея',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Нет доступа', 'Нужно разрешение на доступ к галерее');
              return;
            }
            // No native crop step — the avatar circle already clips
            // whatever's picked via CSS (borderRadius + cover), and the
            // system crop dialog was a confusing extra step with no clear
            // "done" affordance on some devices/launchers.
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              await persistAvatar(result.assets[0].uri);
            }
          } catch (error: any) {
            if (__DEV__) console.error('[HomePage] Gallery avatar pick failed:', error);
            Alert.alert('Ошибка', error?.message || 'Не удалось выбрать фото. Попробуйте ещё раз.');
          }
        },
      },
      {
        text: 'Камера',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert('Нет доступа', 'Нужно разрешение на использование камеры');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              await persistAvatar(result.assets[0].uri);
            }
          } catch (error: any) {
            if (__DEV__) console.error('[HomePage] Camera avatar pick failed:', error);
            Alert.alert('Ошибка', error?.message || 'Не удалось сделать фото. Попробуйте ещё раз.');
          }
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim() || DEFAULT_NICKNAME;
    setNickname(trimmed);
    setEditingNickname(false);
    await AsyncStorage.setItem('@profile_nickname', trimmed);
  };

  // Обновлять баланс при возврате на экран
  useFocusEffect(
    useCallback(() => {
      fetchBalance();
    }, [fetchBalance])
  );

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  }, [fetchBalance]);

  // Адаптивные размеры на основе текущей ширины экрана
  const BANNER_WIDTH = width - wp(32);
  const iconSize = responsive({ xs: 28, sm: 32, lg: 36, default: 32 });

  const toggleLanguage = () => {
    if (language === 'en') {
      setLanguage('ru');
    } else if (language === 'ru') {
      setLanguage('uk');
    } else {
      setLanguage('en');
    }
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'en':
        return 'EN';
      case 'ru':
        return 'РУ';
      case 'uk':
        return 'УК';
      default:
        return 'EN';
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t.common.deleteAccount, t.common.deleteAccountConfirm, [
      {
        text: t.common.cancel,
        style: 'cancel',
      },
      {
        text: t.common.delete,
        onPress: async () => {
          try {
            await deleteAccountMutation.mutateAsync();
          } catch (error: any) {
            Alert.alert(t.common.error, t.common.deleteAccountFailed);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleOpenSettings = () => {
    navigation.navigate('Settings');
  };

  // en uses a period, ru/uk use a comma — toLocaleString() alone doesn't
  // reliably follow app language on Hermes, which defaults to its own locale
  // regardless of what language the user picked in-app.
  const formattedBalance = userBalance.toFixed(2).replace('.', language === 'en' ? '.' : ',');

  const handleOpenFacebook = () => {
    if (!FACEBOOK_PAGE_URL) {
      Alert.alert(t.common.error, 'Facebook page URL is not configured yet.');
      return;
    }
    void Linking.openURL(FACEBOOK_PAGE_URL);
  };

  const handleOpenTops = () => {
    // No leaderboard screen/backend yet — placeholder until that feature exists.
    Alert.alert(t.main.home.topsTitle, language === 'en' ? 'Coming soon' : language === 'uk' ? 'Скоро' : 'Скоро');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />
      <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0EA5E9']} />
          }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            {/* Avatar */}
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={30} color="#0EA5E9" strokeWidth={2} />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Camera size={14} color="#FFFFFF" strokeWidth={2} />
              </View>
            </TouchableOpacity>

            {/* Nickname + Edit */}
            <View style={styles.profileTextColumn}>
              <View style={styles.nicknameRow}>
                {editingNickname ? (
                  <TextInput
                    style={styles.nicknameInput}
                    value={nicknameInput}
                    onChangeText={setNicknameInput}
                    onSubmitEditing={handleSaveNickname}
                    onBlur={handleSaveNickname}
                    autoFocus
                    returnKeyType="done"
                    maxLength={30}
                  />
                ) : (
                  <Text style={styles.nicknameText}>{nickname}</Text>
                )}
                {!editingNickname && (
                  <TouchableOpacity
                    onPress={() => { setNicknameInput(nickname); setEditingNickname(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Pencil size={13} color="#64748B" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.welcomeText}>{t.main.home.greeting}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.settingsIconButton}
              onPress={handleOpenSettings}
              activeOpacity={0.7}>
              <Settings size={sizes.iconMD} color="#0EA5E9" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={toggleLanguage}
              activeOpacity={0.7}>
              <Languages size={sizes.iconMD} color="#0EA5E9" strokeWidth={2} />
              <Text style={styles.languageText}>{getLanguageLabel()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Banner - Balance Card */}
        <View style={styles.bannerSection}>
          <ImageBackground
            source={require('../../../assets/header.png')}
            style={styles.balanceBanner}
            imageStyle={styles.balanceBannerImage}
            resizeMode="cover">
            {/* Padding lives here, not on the ImageBackground's own style —
                ImageBackground internally gives its <Image> a width equal to
                this style's width value, and RN resolves that percentage
                against the parent's content box (i.e. minus its own
                padding). Padding on the same style you're feeding the image
                shrinks the image itself, leaving a gap where the card's
                backgroundColor shows through. */}
            <View style={styles.balanceBannerContent}>
              <View style={styles.balanceLabelRow}>
                <Plane size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.balanceBannerLabel}>{t.main.home.balance}</Text>
              </View>
              <View style={styles.balanceAmountRow}>
                <Text style={styles.balanceBannerAmount}>{formattedBalance}</Text>
                <Text style={styles.balanceBannerUnit}>TWA</Text>
              </View>
              <Text style={styles.balanceBannerHint}>{t.main.home.hint}</Text>
              <View style={styles.balanceButtonsRow}>
                <View style={styles.adButtonSlot}>
                  <RewardedAdButton onSuccess={() => void fetchBalance()} />
                </View>
                <View style={styles.buyButtonSlot}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('TopUp')}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.main.home.buyTwaBtn} TWA`}
                    style={styles.buyImageButtonWrapper}>
                    <Image
                      source={require('../../../assets/buy_twa.png')}
                      style={styles.buyButtonImage}
                      resizeMode="contain"
                    />
                    {/* "TWA" stays baked into the graphic — only "Купить"
                        is overlaid so it changes with the app language. */}
                    <View style={styles.buyButtonTitleSlot} pointerEvents="none">
                      <Text style={styles.buyButtonTitleText} numberOfLines={1}>
                        {t.main.home.buyTwaBtn}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Shop */}
        <View style={styles.shopSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.shopCard}
            onPress={() => navigation.navigate('BonusShop')}>
            <View style={styles.shopIconBox}>
              <ShoppingBag size={wp(24)} color="#0EA5E9" strokeWidth={2.2} />
            </View>
            <View style={styles.shopTextBox}>
              <Text style={styles.shopTitle}>{t.main.home.shopTitle}</Text>
              <Text style={styles.shopSubtitle}>{t.main.home.shopSubtitle}</Text>
            </View>
            <ChevronRight size={wp(20)} color="#94A3B8" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Wheel of Fortune */}
        <View style={styles.wheelSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('WheelOfFortune')}>
            <ImageBackground
              source={require('../../../assets/koleso.png')}
              style={styles.wheelBanner}
              imageStyle={styles.wheelBannerImage}
              resizeMode="cover">
              <View style={styles.wheelBannerContent}>
                <Text style={styles.wheelTitle}>
                  {WHEEL_TITLE[language] ?? WHEEL_TITLE.ru}
                </Text>
                <Text style={styles.wheelSubtitle}>{t.main.home.wheelSubtitle}</Text>
                <View style={styles.playNowButton}>
                  <Text style={styles.playNowButtonText}>{t.main.home.playNow}</Text>
                  <ChevronRight size={wp(16)} color="#1E293B" strokeWidth={2.5} />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.main.home.quickActions}</Text>
          <View style={styles.gamesContainer}>
            <TouchableOpacity
              style={styles.gameItem}
              onPress={handleOpenFacebook}
              activeOpacity={0.82}>
              <View style={[styles.quickActionIconBox, styles.facebookIconBox]}>
                <Facebook size={wp(22)} color="#1877F2" strokeWidth={2} fill="#1877F2" />
              </View>
              <View style={styles.gameInfo}>
                <Text style={styles.gameTitle}>{t.main.home.facebookTitle}</Text>
                <Text style={styles.gameSubtitle}>{t.main.home.facebookSubtitle}</Text>
              </View>
              <ChevronRight size={wp(18)} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gameItem, styles.gameItemLast]}
              onPress={handleOpenTops}
              activeOpacity={0.82}>
              <View style={[styles.quickActionIconBox, styles.topsIconBox]}>
                <Trophy size={wp(22)} color="#8B5CF6" strokeWidth={2} />
              </View>
              <View style={styles.gameInfo}>
                <Text style={styles.gameTitle}>{t.main.home.topsTitle}</Text>
                <Text style={styles.gameSubtitle}>{t.main.home.topsSubtitle}</Text>
              </View>
              <ChevronRight size={wp(18)} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Ad — между секциями */}
        <View style={styles.adBannerSlot}>
          <AdBanner />
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
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(8),
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
  },
  avatarWrapper: {
    width: wp(52),
    height: wp(52),
    borderRadius: wp(26),
    position: 'relative',
  },
  avatarImage: {
    width: wp(52),
    height: wp(52),
    borderRadius: wp(26),
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: wp(52),
    height: wp(52),
    borderRadius: wp(26),
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: wp(26),
    height: wp(26),
    borderRadius: wp(13),
    backgroundColor: '#29B5C3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  profileTextColumn: {
    justifyContent: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
  },
  welcomeText: {
    fontSize: fontSize(13),
    color: '#64748B',
    fontWeight: '500',
    marginTop: hp(2),
  },
  nicknameText: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
  },
  nicknameInput: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0EA5E9',
    minWidth: wp(100),
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
  },
  settingsIconButton: {
    width: wp(42),
    height: wp(42),
    borderRadius: wp(14),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    borderRadius: wp(16),
    gap: wp(6),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  languageText: {
    fontSize: fontSize(14),
    fontWeight: '700',
    color: '#0EA5E9',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
    borderRadius: wp(16),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: fontSize(11),
    color: '#64748B',
    fontWeight: '600',
    marginBottom: hp(2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#0EA5E9',
  },
  bannerSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
  },
  balanceBanner: {
    width: '100%',
    borderRadius: wp(20),
    overflow: 'hidden',
    backgroundColor: '#38BDF8',
  },
  balanceBannerContent: {
    paddingHorizontal: wp(20),
    paddingVertical: hp(20),
  },
  balanceBannerImage: {
    borderRadius: wp(20),
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: hp(10),
  },
  balanceBannerLabel: {
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: wp(6),
    marginBottom: hp(6),
  },
  balanceBannerAmount: {
    fontSize: responsive({ xs: fontSize(32), sm: fontSize(36), default: fontSize(40) }),
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: responsive({ xs: fontSize(36), sm: fontSize(40), default: fontSize(44) }),
  },
  balanceBannerUnit: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(4),
  },
  balanceBannerHint: {
    maxWidth: '65%',
    fontSize: fontSize(13),
    lineHeight: fontSize(18),
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '500',
    marginBottom: hp(18),
  },
  balanceButtonsRow: {
    flexDirection: 'row',
    gap: wp(10),
  },
  adButtonSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  buyButtonSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  buyImageButtonWrapper: {
    width: '100%',
    aspectRatio: BUY_BUTTON_IMAGE_RATIO,
  },
  buyButtonImage: {
    width: '100%',
    height: '100%',
  },
  // Fills the gap above "TWA" where "Buy" used to be baked into the
  // graphic — left-aligned to the same edge as the "TWA" text below it.
  buyButtonTitleSlot: {
    position: 'absolute',
    left: '39%',
    top: '6%',
    width: '40%',
    height: '42%',
    justifyContent: 'center',
  },
  buyButtonTitleText: {
    fontSize: fontSize(14),
    fontWeight: '800',
    color: '#152A4D',
    textAlign: 'left',
  },
  shopSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(14),
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
    backgroundColor: '#EAF4FD',
    borderRadius: wp(18),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    borderWidth: 1,
    borderColor: '#D6EAFB',
  },
  shopIconBox: {
    width: wp(48),
    height: wp(48),
    borderRadius: wp(14),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopTextBox: {
    flex: 1,
  },
  shopTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(2),
  },
  shopSubtitle: {
    fontSize: fontSize(13),
    color: '#64748B',
    fontWeight: '500',
  },
  wheelSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(14),
  },
  wheelBanner: {
    width: '100%',
    minHeight: hp(150),
    borderRadius: wp(20),
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#7C3AED',
  },
  wheelBannerContent: {
    padding: wp(20),
  },
  wheelBannerImage: {
    borderRadius: wp(20),
  },
  wheelTitle: {
    fontSize: fontSize(19),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(6),
    maxWidth: '65%',
  },
  wheelSubtitle: {
    fontSize: fontSize(13),
    lineHeight: fontSize(18),
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '500',
    maxWidth: '62%',
    marginBottom: hp(14),
  },
  playNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: wp(4),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
    borderRadius: wp(18),
  },
  playNowButtonText: {
    fontSize: fontSize(13),
    fontWeight: '700',
    color: '#1E293B',
  },
  section: {
    paddingTop: hp(24),
  },
  adBannerSlot: {
    marginTop: hp(16),
    marginBottom: hp(4),
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
    paddingHorizontal: wp(16),
    marginBottom: hp(12),
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: wp(16),
    gap: wp(12),
    justifyContent: 'space-between',
  },
  singleCardContainer: {
    paddingHorizontal: wp(16),
  },
  actionCard: {
    flex: 1,
    minWidth: wp(150),
    marginBottom: hp(4),
  },
  fullWidthCard: {
    width: '100%',
  },
  cardGradient: {
    width: '100%',
    height: hp(140),
    borderRadius: wp(20),
    padding: wp(16),
    justifyContent: 'space-between',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  cardSolid: {
    width: '100%',
    height: 140,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  cardIcon: {
    width: wp(56),
    height: wp(56),
    borderRadius: wp(16),
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconWithLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  goldenLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  cardTitle: {
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(2),
  },
  cardTitleDark: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize(13),
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  cardSubtitleDark: {
    fontSize: 13,
    color: '#0EA5E9',
    fontWeight: '500',
  },
  gamesContainer: {
    marginHorizontal: wp(16),
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    overflow: 'hidden',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: wp(12),
  },
  gameItemLast: {
    borderBottomWidth: 0,
  },
  quickActionIconBox: {
    width: wp(48),
    height: wp(48),
    borderRadius: wp(14),
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  facebookIconBox: {
    backgroundColor: '#E7F0FE',
  },
  topsIconBox: {
    backgroundColor: '#F1E9FE',
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(2),
  },
  gameSubtitle: {
    fontSize: fontSize(13),
    color: '#64748B',
    fontWeight: '500',
  },
  newBadge: {
    paddingHorizontal: wp(8),
    paddingVertical: hp(3),
    borderRadius: wp(20),
  },
  newBadgeText: {
    fontSize: fontSize(11),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  soonBadge: {
    paddingHorizontal: wp(10),
    paddingVertical: hp(4),
    borderRadius: wp(20),
    backgroundColor: '#E2E8F0',
    marginRight: wp(6),
  },
  soonBadgeText: {
    fontSize: fontSize(11),
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  gameItemDisabled: {
    opacity: 0.65,
  },
  gameTitleDisabled: {
    color: '#94A3B8',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: wp(16),
    backgroundColor: '#FFFFFF',
    paddingVertical: hp(14),
    borderRadius: wp(16),
    gap: wp(10),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  logoutButtonText: {
    fontSize: fontSize(16),
    fontWeight: '600',
    color: '#0EA5E9',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: wp(16),
    marginTop: hp(12),
    paddingVertical: hp(14),
    borderRadius: wp(16),
    gap: wp(10),
  },
  deleteAccountButtonText: {
    fontSize: fontSize(14),
    fontWeight: '500',
    color: '#EF4444',
  },
});
