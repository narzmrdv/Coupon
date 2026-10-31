import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Download, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage, useDocuments } from '../../shared/lib/hooks';

import type { Document as ApiDocument } from '../../shared/types/document';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { DocumentViewer } from '../../shared/ui/DocumentViewer';
import { downloadDocumentToDevice } from '../../shared/lib/utils/downloadDocument';
import { wp, hp, fontSize } from '../../shared/lib/responsive';

const getFullUrl = (url: string) =>
  url.startsWith('http')
    ? url
    : `https://twaio.net${url.startsWith('/') ? '' : '/'}${url}`;

export const DocumentsScreen = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<ApiDocument | null>(null);

  const { data: documents = [], isLoading, refetch } = useDocuments();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.mimetype.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDocument = (doc: ApiDocument) => {
    setViewerDoc(doc);
  };

  const handleDownloadDocument = async (doc: ApiDocument) => {
    if (downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const outcome = await downloadDocumentToDevice({
        url: getFullUrl(doc.url),
        fileName: doc.originalName,
        mimeType: doc.mimetype,
      });
      if (outcome === 'saved') {
        Alert.alert(t.main.documents.downloadedTitle, t.main.documents.downloadedToDownloadsMessage);
      } else if (outcome === 'shared') {
        Alert.alert(t.main.documents.downloadedTitle, t.main.documents.downloadedMessage);
      }
    } catch (error) {
      if (__DEV__) console.error('[DocumentsScreen] Failed to download document:', error);
      Alert.alert(t.main.documents.downloadErrorTitle, t.main.documents.downloadError);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.main.documents.title}</Text>
        <Text style={styles.headerSubtitle}>
          {filteredDocuments.length} {t.main.documents.documents}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={wp(20)} color="#94A3B8" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.main.documents.searchPlaceholder}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0EA5E9']}
            tintColor="#0EA5E9"
          />
        }>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>{t.common.loading}</Text>
          </View>
        ) : filteredDocuments.length > 0 ? (
          <View style={styles.documentsList}>
            <View style={styles.cardsGroup}>
              {filteredDocuments.map((doc, index) => {
                const fileSize = (doc.size / 1024 / 1024).toFixed(2);
                const date = new Date(doc.createdAt).toLocaleDateString();

                const isFirst = index === 0;
                const isLast = index === filteredDocuments.length - 1;

                return (
                  <React.Fragment key={doc.id}>
                    <LinearGradient
                      colors={
                        index % 3 === 0
                          ? ['#38BDF8', '#0EA5E9']
                          : index % 3 === 1
                            ? ['#A78BFA', '#8B5CF6']
                            : ['#34D399', '#10B981']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.documentCard,
                        isFirst && styles.documentCardFirst,
                        isLast && styles.documentCardLast,
                      ]}>

                      <TouchableOpacity
                        style={styles.cardPressArea}
                        onPress={() => handleOpenDocument(doc)}
                        activeOpacity={0.8}>
                        <View style={styles.documentIconContainer}>
                          <FileText size={wp(24)} color="#FFFFFF" strokeWidth={2} />
                        </View>
                        <View style={styles.documentInfo}>
                          <Text style={styles.documentTitle} numberOfLines={1}>
                            {doc.originalName}
                          </Text>
                          <View style={styles.documentMeta}>
                            <Text style={styles.documentType} numberOfLines={1}>
                              {doc.mimetype}
                            </Text>
                            <View style={styles.metaDivider} />
                            <Text style={styles.documentDate}>{date}</Text>
                          </View>
                          <Text style={styles.documentSize}>{fileSize} MB</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => void handleDownloadDocument(doc)}
                        disabled={downloadingId === doc.id}
                        activeOpacity={0.8}>
                        {downloadingId === doc.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Download size={wp(22)} color="#FFFFFF" strokeWidth={2} />
                        )}
                      </TouchableOpacity>

                    </LinearGradient>
                    {index < filteredDocuments.length - 1 && (
                      <View style={styles.cardSeparator} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={wp(64)} color="#CBD5E1" strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t.main.documents.noDocuments}</Text>
            <Text style={styles.emptySubtext}>{t.main.documents.noDocumentsHint}</Text>
          </View>
        )}
        <View style={{ height: hp(100) }} />
      </ScrollView>

      {/* In-app document viewer */}
      {viewerDoc && (
        <DocumentViewer
          visible={!!viewerDoc}
          url={getFullUrl(viewerDoc.url)}
          fileName={viewerDoc.originalName}
          mimeType={viewerDoc.mimetype}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: wp(20),
    paddingTop: hp(12),
    paddingBottom: hp(16),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: fontSize(28), fontWeight: '700', color: '#1E293B', marginBottom: hp(4) },
  headerSubtitle: { fontSize: fontSize(14), color: '#64748B', fontWeight: '500' },
  searchContainer: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    backgroundColor: '#FFFFFF',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: wp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    gap: wp(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: fontSize(15), color: '#1E293B', fontWeight: '500' },
  scrollContent: { paddingTop: 8 },
  documentsList: { paddingHorizontal: wp(16) },
  cardsGroup: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: 'rgba(200,220,255,0.5)',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  documentCardFirst: {
    borderTopLeftRadius: wp(16),
    borderTopRightRadius: wp(16),
  },
  documentCardLast: {
    borderBottomLeftRadius: wp(16),
    borderBottomRightRadius: wp(16),
  },
  cardPressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(12),
    paddingHorizontal: wp(14),
  },
  documentIconContainer: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(12),
    flexShrink: 0,
  },
  documentInfo: { flex: 1, gap: hp(4) },
  documentTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(2),
  },
  documentMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  documentType: {
    fontSize: fontSize(12),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    maxWidth: '50%',
  },
  documentDate: { fontSize: fontSize(12), fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  documentSize: {
    fontSize: fontSize(12),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginTop: hp(2),
  },
  metaDivider: {
    width: wp(3),
    height: wp(3),
    borderRadius: wp(1.5),
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginHorizontal: wp(6),
  },
  actionButton: {
    width: wp(64),
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(120),
    gap: hp(12),
  },
  emptyText: { fontSize: fontSize(20), fontWeight: '700', color: '#64748B', marginTop: hp(16) },
  emptySubtext: { fontSize: fontSize(14), fontWeight: '500', color: '#94A3B8' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(120),
    gap: hp(16),
  },
  loadingText: { fontSize: fontSize(16), fontWeight: '600', color: '#64748B' },
});
