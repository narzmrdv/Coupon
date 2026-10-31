import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MobileAds from 'react-native-google-mobile-ads';

import './global.css';

import RootNavigator from '@/app/navigation/RootNavigator';
import { ApiProvider } from '@/app/providers/ApiProvider';
import { LanguageProvider } from '@/shared/lib/hooks';
import { handleRootNavigationState, preloadRewardedAd } from '@/shared/lib/admob';
import { useUpdateCheck } from '@/shared/lib/hooks/useUpdateCheck';
import { navigationRef } from '@/shared/lib/navigation/navigationRef';
import {
  checkInitialNotificationRoute,
  setupNotificationResponseListener,
} from '@/shared/lib/notifications/pushService';

function AppContent() {
  useUpdateCheck();

  // Tapping a push notification while the app is already running/backgrounded.
  useEffect(() => setupNotificationResponseListener(), []);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => checkInitialNotificationRoute()}
        onStateChange={(state) => {
          void handleRootNavigationState(state);
        }}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void MobileAds()
      .initialize()
      .then((adapterStatuses) => {
        console.log('AdMob initialized:', adapterStatuses);
        preloadRewardedAd();
      })
      .catch((e: unknown) => {
        console.warn('AdMob init failed:', e);
      });
  }, []);

  return (
    <LanguageProvider>
      <ApiProvider>
        <AppContent />
      </ApiProvider>
    </LanguageProvider>
  );
}
