import { useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.travelwithalina.app';
const VERSION_CHECK_URL = 'https://twaio.net/api/version';

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [la, lb, lc] = parse(latest);
  const [ca, cb, cc] = parse(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

export function useUpdateCheck() {
  useEffect(() => {
    const checkForUpdate = async () => {
      if (Platform.OS === 'ios') {
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(VERSION_CHECK_URL, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return;

        const data = (await res.json()) as { version?: string; latestVersion?: string };
        const latestVersion = data.version ?? data.latestVersion;
        if (!latestVersion) return;

        const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';

        if (isNewer(latestVersion, currentVersion)) {
          Alert.alert(
            'Доступно обновление',
            `Новая версия ${latestVersion} уже доступна в Google Play. Обновите приложение для улучшенного опыта!`,
            [
              { text: 'Позже', style: 'cancel' },
              {
                text: 'Обновить',
                onPress: () => {
                  void Linking.openURL(PLAY_STORE_URL);
                },
              },
            ],
          );
        }
      } catch {
        // Silent fail — don't block user if version check is unavailable
      }
    };

    void checkForUpdate();
  }, []);
}
