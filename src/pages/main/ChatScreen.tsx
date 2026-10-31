import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Paperclip } from 'lucide-react-native';
import { useState, useRef, useEffect, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  useLanguage,
  useMessageHistory,
  useSendMessage,
  useMarkAsRead,
  useAdmin,
  useProfile,
  MESSAGE_KEYS,
} from '../../shared/lib/hooks';
import { socketService } from '../../shared/lib/socket/socketService';
import { apiClient } from '../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../shared/config/api';
import type { PrivateMessage } from '../../shared/types/message';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { LinkifiedText } from '../../shared/ui/LinkifiedText';
import { wp, hp, fontSize, sizes, responsive } from '../../shared/lib/responsive';
import {
  formatChatDayLabel,
  formatChatMessageDateTime,
  getChatDayKey,
} from '../../shared/lib/utils/formatChatDate';
import { useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { MainTabParamList } from '@/app/navigation/MainStack';

const { screenWidth: SCREEN_WIDTH, screenHeight: SCREEN_HEIGHT } = sizes;

type ChatRouteProp = RouteProp<MainTabParamList, 'Chat'>;

export const ChatScreen = () => {
  const { t, language } = useLanguage();
  const dateLabels = useMemo(
    () => ({ today: t.common.today, yesterday: t.common.yesterday }),
    [t.common.today, t.common.yesterday],
  );
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoSendDraftRef = useRef(false);
  const queryClient = useQueryClient();

  // Получаем текущего пользователя
  const { data: profile } = useProfile();
  const currentUserId = profile?.id;

  // Получаем ID админа из API
  const { data: admin, isLoading: isLoadingAdmin } = useAdmin();
  const ADMIN_ID = admin?.id || 2; // Fallback на 2 если еще загружается
  // Kept in sync below so socket event handlers always see the latest
  // ADMIN_ID without needing the connect/listen effect to depend on it —
  // that dependency used to tear down and rebuild the whole socket
  // connection every time ADMIN_ID flipped from the fallback to the real
  // id, right when the chat had just connected.
  const adminIdRef = useRef(ADMIN_ID);
  useEffect(() => {
    adminIdRef.current = ADMIN_ID;
  }, [ADMIN_ID]);

  // Загружаем историю сообщений с админом
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch,
  } = useMessageHistory(ADMIN_ID);
  const sendMessageMutation = useSendMessage();
  const markAsReadMutation = useMarkAsRead();

  const isLoading = isLoadingAdmin || isLoadingMessages;

  // Auto-send a message handed off from another screen (e.g. Bonus Shop
  // "Apply reward" — should land in chat already sent, not just typed).
  // Uses the same ADMIN_ID fallback the rest of this screen already trusts
  // for every other send — no extra wait, so it fires immediately instead
  // of sitting around waiting on the admin-id request to settle.
  // Guards against double-send via a ref, and clears the param afterwards
  // so remounting this screen later doesn't resend it.
  useEffect(() => {
    const draft = route.params?.draftMessage;
    if (!draft || autoSendDraftRef.current) return;
    autoSendDraftRef.current = true;
    navigation.setParams({ draftMessage: undefined } as never);

    sendMessageMutation
      .mutateAsync({ receiverId: ADMIN_ID, message: draft })
      .then(() => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      })
      .catch((error) => {
        if (__DEV__) console.error('[ChatScreen] Failed to auto-send draft message:', error);
        // Fall back to pre-filling the input so the user can send it manually.
        setInputText(draft);
      });
  }, [route.params?.draftMessage, ADMIN_ID, navigation, sendMessageMutation]);

  // Подключаемся к WebSocket при монтировании.
  // Deliberately NOT depending on ADMIN_ID — it flips from the fallback (2)
  // to the real id shortly after mount, and reconnecting the whole socket
  // right at that moment (tearing down a connection that had just started
  // working) is what made chat unreliable. Handlers read the current value
  // via adminIdRef instead.
  useEffect(() => {
    // Обработчик новых сообщений - используем queryClient для оптимистичного обновления
    const handleNewMessage = (message: PrivateMessage) => {
      const adminId = adminIdRef.current;
      if (__DEV__) {
        console.log('[ChatScreen] 📨 NEW MESSAGE EVENT RECEIVED:');
        console.log('  - Message ID:', message.id);
        console.log('  - From:', message.senderId);
        console.log('  - To:', message.receiverId);
        console.log('  - Text:', message.message);
        console.log('  - Current ADMIN_ID:', adminId);
        console.log('  - Current User ID:', currentUserId);
      }

      // Получаем текущий кеш сообщений
      const currentMessages = queryClient.getQueryData<PrivateMessage[]>(
        MESSAGE_KEYS.history(adminId)
      );
      if (__DEV__) console.log('  - Current cached messages count:', currentMessages?.length || 0);

      // Проверяем, не дублируется ли сообщение
      const isDuplicate = currentMessages?.some((msg) => msg.id === message.id);
      if (isDuplicate) {
        if (__DEV__) console.log('  - ⚠️ DUPLICATE MESSAGE, skipping update');
        return;
      }

      // Оптимистично обновляем кеш
      queryClient.setQueryData<PrivateMessage[]>(MESSAGE_KEYS.history(adminId), (old) => {
        const updated = old ? [...old, message] : [message];
        if (__DEV__) console.log('  - ✅ Cache updated, new count:', updated.length);
        return updated;
      });

      // Автоматически отмечаем как прочитанные если это сообщение от админа
      if (message.senderId === adminId) {
        if (__DEV__) console.log('  - 📖 Marking as read (message from admin)');
        markAsReadMutation.mutate(adminId);
      }
    };

    // Обработчик индикатора печати
    const handleUserTyping = (data: { userId: number; isTyping: boolean }) => {
      if (__DEV__) console.log('[ChatScreen] ⌨️ TYPING EVENT:', data);
      if (data.userId === adminIdRef.current) {
        setIsTyping(data.isTyping);
      }
    };

    let cancelled = false;

    // Async функция для подключения и подписки.
    // Retries with backoff instead of giving up after one failed attempt —
    // a single failure here (e.g. the auth token not being readable yet on
    // a cold app start) used to leave the socket permanently unconnected
    // for the whole lifetime of this screen, since nothing else ever
    // called connect() again. That's what made chat "wake up" only once
    // something unrelated (like a Bonus Shop purchase) happened to trigger
    // another connect() attempt.
    const setupSocket = async () => {
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          if (__DEV__) console.log(`[ChatScreen] 🔌 Connecting to WebSocket... (attempt ${attempt + 1})`);
          await socketService.connect();
          if (cancelled) return;
          if (__DEV__) console.log('[ChatScreen] ✅ Connected! Now subscribing to events...');

          // Подписываемся на события ПОСЛЕ подключения
          socketService.onNewMessage(handleNewMessage);
          socketService.onUserTyping(handleUserTyping);
          if (__DEV__) console.log('[ChatScreen] ✅ Successfully subscribed to events');
          return;
        } catch (error) {
          if (__DEV__) console.error(`[ChatScreen] ❌ Connect attempt ${attempt + 1} failed:`, error);
          if (attempt < MAX_ATTEMPTS - 1 && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
      if (__DEV__ && !cancelled) {
        console.error('[ChatScreen] ❌ Giving up on socket connection after all retries');
      }
    };

    setupSocket();

    return () => {
      cancelled = true;
      if (__DEV__) console.log('[ChatScreen] 🔌 Disconnecting and cleaning up...');
      socketService.disconnect();
      socketService.removeAllListeners();
    };
  }, [currentUserId, queryClient]);

  // Отмечаем сообщения прочитанными при открытии чата и когда узнаём
  // реальный ADMIN_ID (был вынесен из эффекта подключения — раньше это
  // само по себе заставляло пересоздавать сокет при каждой смене ADMIN_ID).
  useEffect(() => {
    if (!ADMIN_ID) return;
    markAsReadMutation.mutate(ADMIN_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ADMIN_ID]);

  // Автоматический скролл при новых сообщениях
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');

    // Останавливаем индикатор печати
    if (socketService.isConnected()) {
      socketService.sendTyping({
        receiverId: ADMIN_ID,
        isTyping: false,
      });
    }

    try {
      await sendMessageMutation.mutateAsync({
        receiverId: ADMIN_ID,
        message: messageText,
      });

      // Скроллим вниз после отправки
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      if (__DEV__) console.error('[ChatScreen] Failed to send message:', error);
      // The input was already cleared optimistically above — without this,
      // a failed send just silently disappears with no way to retry it.
      setInputText((current) => current || messageText);
      Alert.alert(
        t.main.chat.error || 'Error',
        t.main.chat.sendError || 'Failed to send the message. Please try again.',
      );
    }
  };

  // Выбор и отправка изображения
  const pickAndSendImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          t.main.chat.permissionRequired || 'Permission required',
          t.main.chat.galleryPermission || 'Please allow access to your photo library to send images.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsUploading(true);

      // Подготавливаем файл для загрузки
      const uri = asset.uri;
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      // Загружаем на сервер
      const uploadResponse = await apiClient.getInstance().post<{ imageUrl: string }>(
        API_CONFIG.ENDPOINTS.MESSAGES.UPLOAD_IMAGE,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );

      const imageUrl = uploadResponse.data.imageUrl;

      // Отправляем сообщение с картинкой
      await sendMessageMutation.mutateAsync({
        receiverId: ADMIN_ID,
        message: '',
        imageUrl,
      });

      // Скроллим вниз
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      if (__DEV__) console.error('[ChatScreen] Failed to send image:', error);
      // Show the real failure reason (and which request it was) instead of
      // a generic message — this endpoint has never been confirmed working
      // against the real backend, so guessing at the cause wastes a round trip.
      const detail = [error?.message, error?.requestUrl].filter(Boolean).join(' — ');
      Alert.alert(
        t.main.chat.error || 'Error',
        detail || t.main.chat.imageSendError || 'Failed to send image. Please try again.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Обработка ввода текста с индикатором печати
  const handleTextChange = (text: string) => {
    setInputText(text);

    if (!socketService.isConnected()) return;

    // Отправляем что начали печатать
    socketService.sendTyping({
      receiverId: ADMIN_ID,
      isTyping: true,
    });

    // Сбрасываем предыдущий таймер
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Через 1 секунду бездействия - перестаем печатать
    const timeout = setTimeout(() => {
      socketService.sendTyping({
        receiverId: ADMIN_ID,
        isTyping: false,
      });
    }, 1000);

    setTypingTimeout(timeout);
  };

  type ChatListItem =
    | { kind: 'date'; id: string; label: string }
    | {
        kind: 'message';
        id: number;
        text: string;
        imageUrl?: string | null;
        isUser: boolean;
        time: string;
        isRead: boolean;
      };

  const chatListItems = useMemo((): ChatListItem[] => {
    const items: ChatListItem[] = [];
    let lastDayKey = '';

    for (const msg of messages) {
      const dayKey = getChatDayKey(msg.createdAt);
      if (dayKey !== lastDayKey) {
        items.push({
          kind: 'date',
          id: `date-${dayKey}`,
          label: formatChatDayLabel(msg.createdAt, language, dateLabels),
        });
        lastDayKey = dayKey;
      }
      items.push({
        kind: 'message',
        id: msg.id,
        text: msg.message,
        imageUrl: msg.imageUrl,
        isUser: msg.senderId !== ADMIN_ID,
        time: formatChatMessageDateTime(msg.createdAt, language, dateLabels),
        isRead: msg.isRead,
      });
    }

    return items;
  }, [messages, language, dateLabels]);

  // Полный URL для изображения
  const getImageFullUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${API_CONFIG.BASE_URL.replace('/api', '')}${imageUrl}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0EA5E9', '#0284C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}>
        <View style={styles.headerContent}>
          {/* Avatar с логотипом */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
            </View>
            <View style={styles.onlineIndicator} />
          </View>

          {/* Info */}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t.main.chat.title}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSubtitle}>
                {t.main.chat.online} • {t.main.chat.fastResponse}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {/* Фон с самолётиками */}
        <AirplaneBackground />

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0EA5E9" />
            </View>
          ) : (
            <>
              {chatListItems.map((item) =>
                item.kind === 'date' ? (
                  <View key={item.id} style={styles.dateContainer}>
                    <Text style={styles.dateText}>{item.label}</Text>
                  </View>
                ) : (
                <View
                  key={item.id}
                  style={[
                    styles.messageWrapper,
                    item.isUser ? styles.userMessageWrapper : styles.supportMessageWrapper,
                  ]}>
                  {/* Аватар поддержки с логотипом */}
                  {!item.isUser && (
                    <View style={styles.messageAvatarContainer}>
                      <View style={styles.messageAvatar}>
                        <Image
                          source={require('../../../assets/logo.png')}
                          style={styles.messageLogoImage}
                        />
                      </View>
                    </View>
                  )}

                  {item.isUser ? (
                    <LinearGradient
                      colors={['#0EA5E9', '#0284C7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.messageBubble, styles.userMessage]}>
                      {item.imageUrl && (
                        <Image
                          source={{ uri: getImageFullUrl(item.imageUrl) }}
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                      )}
                      {item.text ? (
                        <LinkifiedText
                          text={item.text}
                          style={[styles.messageText, styles.userMessageText]}
                          linkStyle={styles.userMessageLink}
                        />
                      ) : null}
                      <View style={styles.messageFooter}>
                        <Text style={[styles.messageTime, styles.userMessageTime]}>
                          {item.time}
                        </Text>
                        <Text style={styles.readStatus}>{item.isRead ? '✓✓' : '✓'}</Text>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.messageBubble, styles.supportMessage]}>
                      {item.imageUrl && (
                        <Image
                          source={{ uri: getImageFullUrl(item.imageUrl) }}
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                      )}
                      {item.text ? (
                        <LinkifiedText
                          text={item.text}
                          style={[styles.messageText, styles.supportMessageText]}
                        />
                      ) : null}
                      <Text style={[styles.messageTime, styles.supportMessageTime]}>
                        {item.time}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Индикатор печати админа */}
              {isTyping && (
                <View style={[styles.messageWrapper, styles.supportMessageWrapper]}>
                  <View style={styles.messageAvatarContainer}>
                    <View style={styles.messageAvatar}>
                      <Image
                        source={require('../../../assets/logo.png')}
                        style={styles.messageLogoImage}
                      />
                    </View>
                  </View>
                  <View style={[styles.messageBubble, styles.supportMessage, styles.typingBubble]}>
                    <Text style={styles.typingText}>{t.main.chat.typing}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[styles.attachButton, isUploading && styles.attachButtonDisabled]}
            activeOpacity={0.7}
            onPress={pickAndSendImage}
            disabled={isUploading}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#0EA5E9" />
            ) : (
              <Paperclip size={wp(22)} color="#64748B" strokeWidth={2} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder={t.main.chat.message}
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
            onPress={sendMessage}
            activeOpacity={0.7}
            disabled={!inputText.trim() || sendMessageMutation.isPending}>
            <LinearGradient
              colors={inputText.trim() ? ['#0EA5E9', '#0284C7'] : ['#E2E8F0', '#E2E8F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendButtonGradient}>
              <Send
                size={wp(20)}
                color={inputText.trim() ? '#FFFFFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingHorizontal: wp(20),
    paddingVertical: hp(16),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: hp(4) },
    shadowOpacity: 0.15,
    shadowRadius: wp(8),
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: wp(14),
  },
  avatar: {
    width: wp(48),
    height: wp(48),
    borderRadius: wp(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp(2) },
    shadowOpacity: 0.1,
    shadowRadius: wp(4),
    elevation: 3,
  },
  logoImage: {
    width: wp(48),
    height: wp(48),
    borderRadius: wp(24),
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: '#22C55E',
    borderWidth: wp(2),
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp(4),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: wp(6),
    height: wp(6),
    borderRadius: wp(3),
    backgroundColor: '#22C55E',
    marginRight: wp(6),
  },
  headerSubtitle: {
    fontSize: fontSize(13),
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
  },
  airplanesBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  airplaneContainer: {
    position: 'absolute',
  },
  messagesContainer: {
    flex: 1,
    zIndex: 1,
  },
  messagesContent: {
    padding: wp(16),
    paddingBottom: hp(10),
  },
  dateContainer: {
    alignItems: 'center',
    marginBottom: hp(20),
  },
  dateText: {
    fontSize: fontSize(12),
    color: '#94A3B8',
    fontWeight: '500',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: wp(12),
  },
  messageWrapper: {
    marginBottom: hp(12),
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  supportMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageAvatarContainer: {
    marginRight: wp(8),
    marginBottom: hp(2),
  },
  messageAvatar: {
    width: wp(32),
    height: wp(32),
    borderRadius: wp(16),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: wp(1),
    borderColor: '#E0F2FE',
    overflow: 'hidden',
  },
  messageLogoImage: {
    width: wp(32),
    height: wp(32),
    borderRadius: wp(16),
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    borderRadius: wp(20),
  },
  userMessage: {
    borderBottomRightRadius: wp(6),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: hp(2) },
    shadowOpacity: 0.2,
    shadowRadius: wp(4),
    elevation: 3,
  },
  supportMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: wp(6),
    borderWidth: wp(1),
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp(1) },
    shadowOpacity: 0.05,
    shadowRadius: wp(3),
    elevation: 1,
  },
  messageText: {
    fontSize: fontSize(15),
    lineHeight: fontSize(22),
    fontWeight: '400',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  // Default link color (#0EA5E9) would blend into this bubble's own blue
  // gradient background — needs a color that reads against both the bubble
  // and the plain white message text above it.
  userMessageLink: {
    color: '#FDE68A',
  },
  supportMessageText: {
    color: '#1E293B',
  },
  messageImage: {
    width: wp(200),
    height: wp(200),
    borderRadius: wp(12),
    marginBottom: hp(6),
  },
  messageTime: {
    fontSize: fontSize(11),
    marginTop: hp(4),
    fontWeight: '500',
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  supportMessageTime: {
    color: '#94A3B8',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    paddingBottom: Platform.OS === 'ios' ? hp(32) : hp(16),
    backgroundColor: '#FFFFFF',
    borderTopWidth: wp(1),
    borderTopColor: '#F1F5F9',
  },
  attachButton: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(22),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(10),
    borderWidth: wp(1),
    borderColor: '#E2E8F0',
  },
  attachButtonDisabled: {
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    minHeight: hp(44),
    maxHeight: hp(100),
    backgroundColor: '#F8FAFC',
    borderRadius: wp(22),
    paddingHorizontal: wp(18),
    paddingTop: Platform.OS === 'ios' ? hp(12) : hp(10),
    paddingBottom: Platform.OS === 'ios' ? hp(12) : hp(10),
    fontSize: fontSize(15),
    color: '#1E293B',
    marginRight: wp(10),
    borderWidth: wp(1),
    borderColor: '#E2E8F0',
  },
  sendButton: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(22),
    overflow: 'hidden',
  },
  sendButtonActive: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: hp(2) },
    shadowOpacity: 0.3,
    shadowRadius: wp(4),
    elevation: 4,
  },
  sendButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(40),
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
    marginTop: hp(4),
  },
  readStatus: {
    fontSize: fontSize(12),
    color: '#E0F2FE',
    fontWeight: '600',
  },
  typingBubble: {
    paddingVertical: hp(12),
    paddingHorizontal: wp(16),
  },
  typingText: {
    fontSize: fontSize(14),
    color: '#64748B',
    fontStyle: 'italic',
  },
});
