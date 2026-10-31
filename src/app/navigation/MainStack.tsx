import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, FileText, MessageCircle, CalendarClock, Plane } from 'lucide-react-native';
import { useLanguage } from '../../shared/lib/hooks';

// Импортируем экраны
import { HomePage } from '../../pages/main/HomePage';
import { DocumentsScreen } from '../../pages/main/DocumentsScreen';
import { ChatScreen } from '../../pages/main/ChatScreen';
import { wp, hp } from '../../shared/lib/responsive';
import { BonusShopScreen } from '../../pages/main/BonusShopScreen';
import { MyPurchasesScreen } from '../../pages/main/MyPurchasesScreen';
import { SettingsScreen } from '../../pages/main/SettingsScreen';
import { LuckyTicketScreen } from '../../pages/main/LuckyTicketScreen';
import { WheelOfFortuneScreen } from '../../pages/main/WheelOfFortuneScreen';
import { MysteryBoxScreen } from '../../pages/main/MysteryBoxScreen';
import { TopUpScreen } from '../../pages/main/TopUpScreen';
import { PaymentWebViewScreen } from '../../pages/main/PaymentWebViewScreen';
import { InstallmentCalculatorScreen } from '../../pages/main/InstallmentCalculatorScreen';
import { TourPaymentScreen } from '../../pages/main/TourPaymentScreen';
import { InstallmentScheduleScreen } from '../../pages/main/InstallmentScheduleScreen';
import { InstallmentPaymentDetailsScreen } from '../../pages/main/InstallmentPaymentDetailsScreen';
import { InstallmentsListScreen } from '../../pages/main/InstallmentsListScreen';
import { withScreenErrorBoundary } from '../../shared/ui/ScreenErrorBoundary';

const SafeHomePage = withScreenErrorBoundary(HomePage);
const SafeChatScreen = withScreenErrorBoundary(ChatScreen);
const SafeDocumentsScreen = withScreenErrorBoundary(DocumentsScreen);
const SafeBonusShopScreen = withScreenErrorBoundary(BonusShopScreen);
const SafeMyPurchasesScreen = withScreenErrorBoundary(MyPurchasesScreen);
const SafeSettingsScreen = withScreenErrorBoundary(SettingsScreen);
const SafeLuckyTicketScreen = withScreenErrorBoundary(LuckyTicketScreen);
const SafeWheelOfFortuneScreen = withScreenErrorBoundary(WheelOfFortuneScreen);
const SafeMysteryBoxScreen = withScreenErrorBoundary(MysteryBoxScreen);
const SafeTopUpScreen = withScreenErrorBoundary(TopUpScreen);
const SafePaymentWebViewScreen = withScreenErrorBoundary(PaymentWebViewScreen);
const SafeInstallmentCalculatorScreen = withScreenErrorBoundary(InstallmentCalculatorScreen);
const SafeTourPaymentScreen = withScreenErrorBoundary(TourPaymentScreen);
const SafeInstallmentScheduleScreen = withScreenErrorBoundary(InstallmentScheduleScreen);
const SafeInstallmentPaymentDetailsScreen = withScreenErrorBoundary(InstallmentPaymentDetailsScreen);
const SafeInstallmentsListScreen = withScreenErrorBoundary(InstallmentsListScreen);

export type MainTabParamList = {
  Home: undefined;
  Documents: undefined;
  // Purely decorative slot in the middle of the tab bar (branding, not a
  // real destination) — see its tabBarButton override below for why it can
  // never actually be navigated to.
  Decoration: undefined;
  Chat: { draftMessage?: string } | undefined;
  Installments: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  BonusShop: undefined;
  MyPurchases: undefined;
  Settings: undefined;
  LuckyTicket: undefined;
  WheelOfFortune: undefined;
  MysteryBox: undefined;
  TopUp: undefined;
  PaymentWebView: { paymentUrl: string; orderReference: string };
  InstallmentCalculator:
    | { tourId?: number; amount?: number }
    | undefined;
  TourPayment:
    | { tourId?: number; amount?: number }
    | undefined;
  InstallmentSchedule: { installmentId: string };
  InstallmentPaymentDetails: { installmentId: string; paymentId: string };
  InstallmentsList: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const iconSize = wp(23);

// Never actually reachable — its tabBarButton (below) renders a plain View
// with no press handler, so this component never mounts. Still required
// because Tab.Screen needs *some* component reference.
function DecorationTabPlaceholder() {
  return null;
}

/**
 * TabNavigator - нижние табы
 */
function TabNavigator() {
  const { t } = useLanguage();
  // getBottomSpace() only ever returns a real value on iOS — on Android it's
  // hardcoded to 0, which left this bar sitting flush with the screen edge
  // and getting covered by the phone's own nav bar (3-button or gesture).
  // Real insets from safe-area-context report the actual system bar height
  // on both platforms, so the tab bar can reserve space above it instead.
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    ...styles.tabBar,
    height: hp(72) + insets.bottom - 5,
    paddingBottom: hp(8) + insets.bottom,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tab.Screen
        name="Home"
        component={SafeHomePage}
        options={{
          tabBarLabel: t.common.navHome,
          tabBarIcon: ({ color }) => <Home size={iconSize} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={SafeDocumentsScreen}
        options={{
          tabBarLabel: t.common.navDocuments,
          tabBarIcon: ({ color }) => <FileText size={iconSize} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Decoration"
        component={DecorationTabPlaceholder}
        options={{
          tabBarButton: () => (
            <View style={styles.centerDecorationWrapper} pointerEvents="none">
              <View style={styles.centerDecoration}>
                <Plane
                  size={wp(30)}
                  color="#FFFFFF"
                  strokeWidth={2}
                />
              </View>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={SafeChatScreen}
        options={{
          tabBarLabel: t.common.navChat,
          tabBarIcon: ({ color }) => <MessageCircle size={iconSize} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Installments"
        component={SafeInstallmentsListScreen}
        options={{
          tabBarLabel: t.common.navInstallments,
          tabBarIcon: ({ color }) => <CalendarClock size={iconSize} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * MainStack - основной стек навигации приложения
 * Содержит табы и дополнительные экраны
 */
export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="BonusShop" component={SafeBonusShopScreen} />
      <Stack.Screen name="MyPurchases" component={SafeMyPurchasesScreen} />
      <Stack.Screen name="Settings" component={SafeSettingsScreen} />
      <Stack.Screen name="LuckyTicket" component={SafeLuckyTicketScreen} />
      <Stack.Screen name="WheelOfFortune" component={SafeWheelOfFortuneScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="MysteryBox" component={SafeMysteryBoxScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="TopUp" component={SafeTopUpScreen} />
      <Stack.Screen name="PaymentWebView" component={SafePaymentWebViewScreen} />
      <Stack.Screen name="InstallmentCalculator" component={SafeInstallmentCalculatorScreen} />
      <Stack.Screen name="TourPayment" component={SafeTourPaymentScreen} />
      <Stack.Screen name="InstallmentSchedule" component={SafeInstallmentScheduleScreen} />
      <Stack.Screen
        name="InstallmentPaymentDetails"
        component={SafeInstallmentPaymentDetailsScreen}
      />
      <Stack.Screen name="InstallmentsList" component={SafeInstallmentsListScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    // height/paddingBottom are overridden per-render in TabNavigator with
    // real safe-area insets — these are just a same-shape fallback.
    height: hp(72),
    paddingTop: hp(4),
    paddingBottom: hp(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    // Lets the center decoration button float above the bar's top edge
    // instead of getting clipped to its bounds.
    overflow: 'visible',
  },
  tabBarLabel: {
    fontSize: wp(11),
    fontWeight: '600',
  },
  centerDecorationWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDecoration: {
    width: wp(62),
    height: wp(62),
    borderRadius: wp(31),
    marginTop: -hp(16),
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
