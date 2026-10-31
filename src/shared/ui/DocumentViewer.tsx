import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { X, Download } from 'lucide-react-native';
import { useLanguage } from '@/shared/lib/hooks';
import { downloadDocumentToDevice } from '@/shared/lib/utils/downloadDocument';
import { wp, hp, fontSize } from '@/shared/lib/responsive';

interface DocumentViewerProps {
  visible: boolean;
  url: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

// Wrap PDF URLs in Google Docs Viewer so WebView can render them on Android
function getViewerUrl(url: string): string {
  const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  if (isPdf) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  visible,
  url,
  fileName,
  mimeType,
  onClose,
}) => {
  const { t } = useLanguage();
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const viewerUrl = getViewerUrl(url);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const outcome = await downloadDocumentToDevice({ url, fileName, mimeType });
      if (outcome === 'saved') {
        Alert.alert(t.main.documents.downloadedTitle, t.main.documents.downloadedToDownloadsMessage);
      } else if (outcome === 'shared') {
        Alert.alert(t.main.documents.downloadedTitle, t.main.documents.downloadedMessage);
      }
    } catch (error) {
      if (__DEV__) console.error('[DocumentViewer] Failed to download document:', error);
      Alert.alert(t.main.documents.downloadErrorTitle, t.main.documents.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/*
        RN's <Modal> presents its content in a separate native window on iOS,
        outside the app's own view hierarchy — the app-level SafeAreaProvider
        can't measure it, so SafeAreaView here would silently get zero top
        inset and the header (close/download buttons) would render right
        under the status bar/notch. A fresh, local SafeAreaProvider fixes
        that by re-measuring insets for this modal's own hierarchy.
      */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
              <X size={22} color="#0F172A" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={handleDownload} style={styles.iconBtn} activeOpacity={0.7} disabled={downloading}>
              {downloading
                ? <ActivityIndicator size="small" color="#0EA5E9" />
                : <Download size={22} color="#0EA5E9" strokeWidth={2} />}
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {webviewLoading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loaderText}>Загрузка...</Text>
              </View>
            )}
            <WebView
              source={{ uri: viewerUrl }}
              style={styles.webview}
              onLoadEnd={() => setWebviewLoading(false)}
              javaScriptEnabled
              scrollEnabled
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(8),
    paddingVertical: hp(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconBtn: { width: wp(44), height: wp(44), alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  body: { flex: 1 },
  webview: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: hp(12),
  },
  loaderText: { fontSize: fontSize(14), color: '#64748B' },
});
