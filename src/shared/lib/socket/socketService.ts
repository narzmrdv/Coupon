import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../../config/api';
import { apiClient } from '../api/apiClient';
import type {
  PrivateMessage,
  SendMessageDto,
  TypingDto,
  SocketTypingEvent,
  SocketReadEvent,
  SocketNotificationEvent,
} from '../../types/message';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectPromise: Promise<void> | null = null;
  private pendingEmits: { event: string; data?: any }[] = [];
  private pendingListeners: {
    event: string;
    callback: (...args: any[]) => void;
    once: boolean;
  }[] = [];

  constructor() {
    // Телефон полежал в кармане/приложение свернули — socket.io обнаруживает
    // обрыв только по своему internal ping-таймауту (десятки секунд). Как
    // только приложение снова активно, форсируем реконнект той же самой
    // socket-инстанции (сохраняя уже подписанные слушатели) вместо того,
    // чтобы ждать, пока библиотека сама заметит "мёртвое" соединение.
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state !== 'active') return;
    if (!this.socket || this.socket.connected) return;
    if (__DEV__) console.log('[Socket] 📱 App became active, reconnecting stale socket...');
    this.socket.connect();
  };

  // Подключение к WebSocket серверу.
  // Конкурентные вызовы (например, Chat и Wheel of Fortune монтируются
  // почти одновременно) переиспользуют один и тот же промис вместо того,
  // чтобы каждый создавал свой собственный socket поверх ещё не
  // подключённого предыдущего — это и вызывало "не с первого раза заходит".
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      if (__DEV__) console.log('[Socket] ⚠️ Already connected, skipping');
      return Promise.resolve();
    }

    if (this.connectPromise) {
      if (__DEV__) console.log('[Socket] ⏳ Connection already in progress, reusing promise');
      return this.connectPromise;
    }

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async doConnect(): Promise<void> {
    if (__DEV__) console.log('[Socket] 🔌 Starting connection...');
    const token = await apiClient.getToken();
    if (!token) {
      console.error('[Socket] ❌ No token found, cannot connect');
      throw new Error('No token found');
    }

    // Убираем предыдущий "зависший" сокет, если он есть, чтобы не плодить
    // параллельные соединения на сервере.
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const socketUrl = API_CONFIG.SOCKET_URL;

    if (__DEV__) console.log('[Socket] 🔌 Connecting to:', socketUrl);

    this.socket = io(socketUrl, {
      path: '/api/socket.io',
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    if (__DEV__) console.log('[Socket] ✅ Socket instance created, setting up listeners...');
    this.setupEventListeners();
    this.flushPendingListeners();

    // Возвращаем промис, который резолвится при подключении
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (__DEV__) console.error('[Socket] ❌ Connection timeout (10s)');
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket?.once('connect', () => {
        clearTimeout(timeout);
        if (__DEV__) console.log('[Socket] ✅ Connection promise resolved');
        this.flushPendingEmits();
        resolve();
      });

      this.socket?.once('connect_error', (error) => {
        clearTimeout(timeout);
        if (__DEV__) console.error('[Socket] ❌ Connection promise rejected:', error.message);
        reject(error);
      });
    });
  }

  private flushPendingEmits(): void {
    if (this.pendingEmits.length === 0) return;
    const queued = this.pendingEmits;
    this.pendingEmits = [];
    if (__DEV__) console.log(`[Socket] 📤 Flushing ${queued.length} queued emit(s)`);
    queued.forEach(({ event, data }) => this.socket?.emit(event, data));
  }

  // Attaches listeners that were registered via on()/once() before the
  // socket instance existed (e.g. useSendMessage subscribes to
  // 'privateMessageSent' the instant a screen mounts, which can race ahead
  // of the first-ever connect()). Without this, those subscriptions were
  // silently lost forever — the message would actually send once the queued
  // emit flushed, but nothing was listening for the server's ack, so the
  // caller always hit its own timeout regardless of real success.
  private flushPendingListeners(): void {
    if (this.pendingListeners.length === 0) return;
    const queued = this.pendingListeners;
    this.pendingListeners = [];
    if (__DEV__) console.log(`[Socket] 🎧 Attaching ${queued.length} queued listener(s)`);
    queued.forEach(({ event, callback, once }) => {
      if (once) this.socket?.once(event, callback);
      else this.socket?.on(event, callback);
    });
  }

  // Настройка базовых событий соединения
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (__DEV__) console.log('[Socket] ✅ CONNECTED SUCCESSFULLY');
      this.reconnectAttempts = 0;

      if (__DEV__) {
        this.socket?.onAny((eventName) => {
          console.log(`[Socket] 📨 EVENT: ${eventName}`);
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[Socket] ❌ DISCONNECTED, reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      if (__DEV__) console.error('[Socket] ❌ CONNECTION ERROR:', error.message);
      this.reconnectAttempts++;

      if (__DEV__ && this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[Socket] ❌ MAX RECONNECTION ATTEMPTS REACHED');
      }
    });

    this.socket.on('error', (error) => {
      if (__DEV__) console.error('[Socket] ❌ ERROR:', error);
    });
  }

  // Отключение от сервера
  disconnect(): void {
    if (this.socket) {
      if (__DEV__) console.log('[Socket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Проверка подключения
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Отправка приватного сообщения.
  // NB: was briefly changed to `socket.timeout().emitWithAck()` with an
  // automatic reconnect-and-resend on timeout, on the assumption the backend
  // acks this event. In practice the backend never acks it, so every send
  // timed out and retried — and since react-query's mutation itself also
  // retries once on failure (see ApiProvider's `mutations: { retry: 1 }`),
  // the two retries multiplied into 4 real duplicate sends reaching the
  // admin before the client finally (and wrongly) reported an error. Back to
  // a single fire-and-forget emit confirmed via the 'privateMessageSent'
  // broadcast (see onMessageSent) — no retry here, so no duplicate risk.
  // Route through emit() so the message queues and auto-flushes once the
  // socket connects instead of being silently dropped when called right
  // after navigation, before the connection has finished (e.g. Bonus Shop
  // → Chat auto-send) — that used to look like a message that just vanishes.
  sendPrivateMessage(data: SendMessageDto): void {
    if (__DEV__) console.log('[Socket] 📤 Sending message to:', data.receiverId);
    this.emit('sendPrivateMessage', data);
  }

  // Отметить сообщения как прочитанные
  markAsRead(partnerId: number): void {
    if (!this.socket) {
      if (__DEV__) console.error('[Socket] Not connected');
      return;
    }

    if (__DEV__) console.log('[Socket] Marking as read, partner:', partnerId);
    this.socket.emit('markAsRead', { partnerId });
  }

  // Индикатор печати
  sendTyping(data: TypingDto): void {
    if (!this.socket) return;

    this.socket.emit('typingPrivate', data);
  }

  // Подписка на новые сообщения
  onNewMessage(callback: (message: PrivateMessage) => void): void {
    if (!this.socket) {
      if (__DEV__) console.error('[Socket] ❌ Cannot subscribe to newPrivateMessage - socket is null');
      return;
    }

    if (__DEV__) console.log('[Socket] ✅ Subscribing to newPrivateMessage event');
    this.socket.on('newPrivateMessage', (message: PrivateMessage) => {
      if (__DEV__) console.log('[Socket] 📨 newPrivateMessage from:', message.senderId);
      callback(message);
    });
  }

  // Подписка на подтверждение отправки
  onMessageSent(callback: (message: PrivateMessage) => void): void {
    if (!this.socket) {
      if (__DEV__) console.error('[Socket] ❌ Cannot subscribe to privateMessageSent - socket is null');
      return;
    }

    if (__DEV__) console.log('[Socket] ✅ Subscribing to privateMessageSent event');
    this.socket.on('privateMessageSent', (message: PrivateMessage) => {
      if (__DEV__) console.log('[Socket] 📤 privateMessageSent:', message.id);
      callback(message);
    });
  }

  // Подписка на прочтение сообщений
  onMessagesRead(callback: (data: SocketReadEvent) => void): void {
    if (!this.socket) return;

    this.socket.on('messagesRead', (data: SocketReadEvent) => {
      if (__DEV__) console.log('[Socket] Messages marked as read:', data);
      callback(data);
    });
  }

  // Подписка на индикатор печати
  onUserTyping(callback: (data: SocketTypingEvent) => void): void {
    if (!this.socket) return;

    this.socket.on('userTypingPrivate', (data: SocketTypingEvent) => {
      if (__DEV__) console.log('[Socket] User typing:', data);
      callback(data);
    });
  }

  // Подписка на приватные уведомления
  onPrivateNotification(callback: (data: SocketNotificationEvent) => void): void {
    if (!this.socket) return;

    this.socket.on('privateNotification', (data: SocketNotificationEvent) => {
      if (__DEV__) console.log('[Socket] Private notification:', data);
      callback(data);
    });
  }

  // Отписка от события
  off(event: string, callback?: (...args: any[]) => void): void {
    // Also drop any still-queued (not yet attached) registration so it
    // doesn't get attached later after the caller has already moved on.
    this.pendingListeners = this.pendingListeners.filter(
      (l) => !(l.event === event && (!callback || l.callback === callback)),
    );
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  // Подписка на событие один раз.
  // Queues if the socket instance doesn't exist yet (see flushPendingListeners).
  once(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      this.pendingListeners.push({ event, callback, once: true });
      return;
    }
    this.socket.once(event, callback);
  }

  // Добавить слушатель события.
  // Queues if the socket instance doesn't exist yet (see flushPendingListeners).
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      this.pendingListeners.push({ event, callback, once: false });
      return;
    }
    this.socket.on(event, callback);
  }

  // Отправить произвольное событие.
  // Если сокет ещё не подключён (например, connect() в процессе), событие
  // становится в очередь и уходит автоматически сразу после подключения —
  // раньше оно просто молча терялось (см. flushPendingEmits).
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      if (__DEV__) console.warn('[Socket] Not connected yet, queueing emit:', event);
      this.pendingEmits.push({ event, data });
      if (this.pendingEmits.length > 20) this.pendingEmits.shift();
      return;
    }
    this.socket.emit(event, data);
  }

  // Отписка от всех событий
  removeAllListeners(): void {
    if (!this.socket) return;

    this.socket.off('newPrivateMessage');
    this.socket.off('privateMessageSent');
    this.socket.off('messagesRead');
    this.socket.off('userTypingPrivate');
    this.socket.off('privateNotification');
  }
}

export const socketService = new SocketService();
