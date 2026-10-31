import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANDROID_DOWNLOADS_DIR_KEY = 'documents:androidDownloadsDirUri';

export type DownloadOutcome = 'saved' | 'shared' | 'cancelled';

async function saveToAndroidDownloads(
  cached: File,
  safeFileName: string,
  mimeType: string,
): Promise<boolean> {
  let dirUri = await AsyncStorage.getItem(ANDROID_DOWNLOADS_DIR_KEY);

  // Up to 2 passes: first with whatever directory grant we already have
  // (skipping the permission prompt entirely on repeat downloads), then
  // once more with a fresh grant if that stored one no longer works (e.g.
  // access was revoked from Android settings after it was saved).
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!dirUri) {
      const initialUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
      if (!permission.granted) return false;
      dirUri = permission.directoryUri;
      await AsyncStorage.setItem(ANDROID_DOWNLOADS_DIR_KEY, dirUri);
    }

    try {
      const base64 = await cached.base64();
      let destUri: string;
      try {
        destUri = await StorageAccessFramework.createFileAsync(dirUri, safeFileName, mimeType);
      } catch {
        // A file with this name already exists in Downloads (e.g. this same
        // document was downloaded before) — SAF won't overwrite, so give the
        // new copy a unique name instead of failing the whole download.
        destUri = await StorageAccessFramework.createFileAsync(
          dirUri,
          `${Date.now()}_${safeFileName}`,
          mimeType,
        );
      }
      await StorageAccessFramework.writeAsStringAsync(destUri, base64, { encoding: 'base64' });
      return true;
    } catch {
      // The stored directory grant no longer works — drop it and let the
      // next loop iteration request a fresh one.
      await AsyncStorage.removeItem(ANDROID_DOWNLOADS_DIR_KEY);
      dirUri = null;
    }
  }
  return false;
}

/**
 * Downloads a remote document and gets it into the user's hands:
 * - Android: writes it into the real, visible Downloads folder via the
 *   Storage Access Framework — a plain cache download + share sheet never
 *   shows up in the Files app's Downloads section, which is what people
 *   actually expect from a "Download" button.
 * - iOS: there is no public Downloads folder to write into; the share
 *   sheet's "Save to Files" is the standard way to store an arbitrary
 *   document there.
 */
export async function downloadDocumentToDevice(options: {
  url: string;
  fileName: string;
  mimeType: string;
}): Promise<DownloadOutcome> {
  const safeFileName = options.fileName.replace(/[^a-zA-Z0-9._\-()]/g, '_');
  // `downloadFileAsync`'s generated type declares its return as the base
  // native `File` type rather than this module's richer `File` subclass
  // (which is what it actually constructs and returns at runtime) — cast to
  // the subclass so `.base64()` below type-checks.
  const cached = (await File.downloadFileAsync(options.url, new File(Paths.cache, safeFileName), {
    idempotent: true,
  })) as File;

  if (Platform.OS === 'android') {
    const saved = await saveToAndroidDownloads(cached, safeFileName, options.mimeType);
    if (saved) return 'saved';
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cached.uri);
    return 'shared';
  }
  return 'cancelled';
}
