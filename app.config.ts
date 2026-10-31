import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withAdMobMediationAndroid = require('./plugins/withAdMobMediationAndroid') as (
  config: ExpoConfig
) => ExpoConfig;

const ADMOB_ANDROID_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID || 'ca-app-pub-3940256099942544~3347511713';

const ADMOB_IOS_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS || 'ca-app-pub-3940256099942544~1458002511';

export default (): ExpoConfig =>
  ({
    name: 'Travel with Alina',
    slug: 'travel-with-alina',
    version: '1.0.61',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    web: {
      favicon: './assets/favicon.png',
    },
    experiments: {
      tsconfigPaths: true,
    },
    android: {
      versionCode: 61,
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.travelwithalina.app',
      googleServicesFile: './google-services.json',
    },
    ios: {
      bundleIdentifier: 'com.travelwithalina.app',
      buildNumber: '3',
      supportsTablet: false,
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDisplayName: 'Travel with Alina',
        NSCameraUsageDescription:
          'Travel with Alina uses the camera so you can take a profile picture for your account.',
        NSPhotoLibraryUsageDescription:
          'Travel with Alina uses your photo library so you can choose a profile picture for your account.',
        NSPhotoLibraryAddUsageDescription:
          'Travel with Alina saves images to your photo library only when you choose to save them.',
        NSMicrophoneUsageDescription:
          'Travel with Alina uses the microphone only when you choose to record media with audio.',
      },
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            extraMavenRepos: ['https://android-sdk.is.com/'],
            // AAPT2 daemon repeatedly timed out crunching large background
            // images (koleso.png/header.png) on this machine's limited RAM.
            enablePngCrunchInReleaseBuilds: false,
          },
        },
      ],
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: ADMOB_ANDROID_APP_ID,
          iosAppId: ADMOB_IOS_APP_ID,
        },
      ],
      withAdMobMediationAndroid,
      'expo-notifications',
      [
        '@react-native-google-signin/google-signin',
        // iosUrlScheme comes from the iOS OAuth client's "REVERSED_CLIENT_ID"
        // in Google Cloud Console. Must be `undefined` (not `{}`) when unset —
        // an empty object is still truthy, which made the plugin take its
        // "manual options" branch and crash requiring iosUrlScheme, instead of
        // falling back to reading it from GoogleService-Info.plist. This only
        // ever showed up under `eas build`, which evaluates the config with
        // .env deliberately disabled (to catch exactly this: config that
        // silently depends on a local-only .env value with no cloud fallback).
        process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
          ? { iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME }
          : undefined,
      ],
    ],
extra: {
      eas: {
        projectId: 'c39e33d9-8631-4ff1-b779-ff6a36e45f27',
      },
    },
  }) as ExpoConfig;
